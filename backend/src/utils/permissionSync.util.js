import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import permissionService from '../features/permission/permission.services.js';
import roleService from '../features/role/role.services.js';
import rolePermissionService from '../features/rolePermission/rolePermission.services.js';
import userService from '../features/user/user.services.js';
import logger from './logger.utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads permissions.json, syncs all permission entries to MongoDB,
 * maps all permissions to the 'Super Admin' role, and bootstraps a Super Admin user.
 */
export const syncPermissions = async () => {
  try {
    logger.info('Starting permission synchronization and Super Admin bootstrapping...');

    // 1. Read the permissions.json list
    const permissionsPath = path.resolve(__dirname, '../config/permissions.json');
    const fileData = await readFile(permissionsPath, 'utf8');
    const features = JSON.parse(fileData);

    // 2. Upsert permissions
    const upsertedPermissions = [];
    for (const item of features) {
      const { feature, actions } = item;
      for (const action of actions) {
        const permission = await permissionService.upsertPermission(feature, action);
        upsertedPermissions.push(permission);
      }
    }
    // 2b. Clean up deleted/obsolete permissions in database
    const PermissionModel = (await import('../features/permission/permission.model.js')).default;
    const RolePermissionModel = (await import('../features/rolePermission/rolePermission.model.js')).default;
    const upsertedIds = upsertedPermissions.map(p => p._id);
    const deletedPermissions = await PermissionModel.find({ _id: { $nin: upsertedIds } });
    if (deletedPermissions.length > 0) {
      const deletedIds = deletedPermissions.map(p => p._id);
      await RolePermissionModel.deleteMany({ permissionId: { $in: deletedIds } });
      await PermissionModel.deleteMany({ _id: { $in: deletedIds } });
      logger.info(`Removed ${deletedPermissions.length} obsolete permissions from database.`);
    }

    logger.info(`Synced ${upsertedPermissions.length} permissions successfully in database.`);

    // 3. Ensure default Platform Organization exists
    const Organization = (await import('../features/organization/organization.model.js')).default;
    let platformOrg = await Organization.findOne({ isPlatform: true });
    if (!platformOrg) {
      platformOrg = await Organization.create({
        name: 'System Platform',
        isPlatform: true,
        status: 'Active',
        organizationType: 'Other',
      });
      logger.info(`Bootstrapped platform Organization: "System Platform" with ID: ${platformOrg._id}`);
    }

    // 4. Ensure Platform Super Admin Role exists for the platform workspace
    let superAdminRole = await roleService.getRoleByName('Platform Super Admin', platformOrg._id);
    if (!superAdminRole) {
      superAdminRole = await roleService.getRoleByName('Super Admin', platformOrg._id);
      if (!superAdminRole) {
        superAdminRole = await roleService.createRole({
          name: 'Platform Super Admin',
          description: 'System-wide Super Administrator role with full access permissions.',
          orgId: platformOrg._id,
        });
        logger.info('Created "Platform Super Admin" role.');
      }
    }

    // 5. Map all system permissions to Platform Super Admin role (only if it has no permissions, preserving custom edits)
    const existingPerms = await rolePermissionService.getPermissionsByRoleId(superAdminRole._id);
    if (existingPerms.length === 0) {
      const permissionIds = upsertedPermissions.map((p) => p._id.toString());
      await rolePermissionService.updateRolePermissions(superAdminRole._id.toString(), permissionIds);
      logger.info('Mapped all system permissions to the "Platform Super Admin" role (first time setup or failsafe).');
    } else {
      logger.info('Platform Super Admin role already has custom permissions. Skipping auto-sync to preserve user edits.');
    }

    // 6. Bootstrap default Super Admin user using env credentials
    const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@enterprise.com').trim().toLowerCase();
    const adminUsername = (process.env.SUPER_ADMIN_USERNAME || 'superadmin').trim();
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdminPwd@123!';

    const { hashPassword } = await import('./crypto.utils.js');
    const User = (await import('../features/user/user.model.js')).default;

    let userByEmail = await User.findOne({ email: adminEmail });
    let userByUsername = await User.findOne({ username: adminUsername });

    let targetUser = userByUsername || userByEmail;

    // Remove conflicting second document if email and username belong to two different documents
    if (userByEmail && userByUsername && userByEmail._id.toString() !== userByUsername._id.toString()) {
      await User.deleteOne({ _id: userByEmail._id });
      targetUser = userByUsername;
    }

    if (!targetUser) {
      targetUser = await userService.createUser({
        email: adminEmail,
        username: adminUsername,
        password: adminPassword,
        status: 'Active',
        roles: [superAdminRole._id],
      });
      logger.info(`Successfully bootstrapped default Super Admin user: email="${adminEmail}", username="${adminUsername}"`);
    } else {
      const hashedPassword = await hashPassword(adminPassword);
      await User.updateOne(
        { _id: targetUser._id },
        { 
          email: adminEmail,
          username: adminUsername,
          password: hashedPassword, 
          status: 'Active', 
          $addToSet: { roles: superAdminRole._id }
        }
      );
      targetUser.status = 'Active';
      logger.info(`Updated existing Super Admin user credentials: email="${adminEmail}", username="${adminUsername}"`);
    }

    // 7. Link Super Admin user to the Platform organization
    const OrgMembership = (await import('../features/orgMembership/orgMembership.model.js')).default;
    let membership = await OrgMembership.findOne({ userId: targetUser._id, orgId: platformOrg._id });
    if (!membership) {
      await OrgMembership.create({
        userId: targetUser._id,
        orgId: platformOrg._id,
        roleIds: [superAdminRole._id],
        roleId: superAdminRole._id,
        status: 'Active',
      });
      logger.info('Linked Super Admin user to the Platform organization with Platform Super Admin role.');
    } else if (membership.status !== 'Active') {
      membership.status = 'Active';
      await membership.save();
      logger.info('Updated existing Super Admin user membership status to Active.');
    }

    // 6.5 Self-healing: Ensure all existing 'Community Admin' roles get their designated administrative baseline permissions mapped
    const COMMUNITY_ADMIN_BASELINE_PERMISSIONS = [
      'users:create', 'users:read', 'users:update', 'users:delete',
      'roles:create', 'roles:read', 'roles:update', 'roles:delete',
      'villas:create', 'villas:read', 'villas:update', 'villas:delete',
      'integrations:create', 'integrations:read', 'integrations:update', 'integrations:delete',
      'amenities:dashboard', 'amenities:admin_calendar', 'amenities:booking_queue', 'amenities:ledgers',
      'amenities:master', 'amenities:maintenance', 'amenities:settings',
      'amenities:discover', 'amenities:my_booking', 'amenities:wallet',
      'amenities:scanner', 'amenities:security_logs',
      'complaints:view', 'complaints:create', 'complaints:update', 'complaints:delete',
      'complaints:assign', 'complaints:dashboard', 'complaints:reports',
      'complaints:calendar', 'complaints:settings', 'complaints:comments',
      'complaints:timeline', 'complaints:export', 'complaints:analytics',
      'complaints:staff', 'complaints:raise_ticket', 'complaints:track_requests',
      'complaints:complaint_management', 'complaints:assignee',
      'visitor:admin', 'visitor:resident', 'visitor:guard',
      'notices:active_board', 'notices:polls', 'notices:manage_notices',
      'polls:read', 'polls:create', 'polls:update', 'polls:delete', 'polls:publish',
      'polls:vote', 'polls:view_voters', 'polls:close', 'polls:export',
      'billing:billing_hub', 'billing:my_dues', 'billing:assessments', 'billing:ledger', 'billing:my_invoices',
      'workspaces:read', 'workspaces:update',
    ];

    const RoleModel = (await import('../features/role/role.model.js')).default;
    const communityAdminRoles = await RoleModel.find({ name: 'Community Admin' });
    const baselinePermissions = await PermissionModel.find({ name: { $in: COMMUNITY_ADMIN_BASELINE_PERMISSIONS } });

    for (const role of communityAdminRoles) {
      const existingMappingsCount = await RolePermissionModel.countDocuments({ roleId: role._id });
      if (existingMappingsCount === 0) {
        for (const perm of baselinePermissions) {
          await RolePermissionModel.create({
            roleId: role._id,
            permissionId: perm._id,
          });
        }
        rolePermissionService.cache.delete(role._id.toString());
        logger.info(`Initialized role "${role.name}" (${role._id}) with baseline permissions.`);
      } else {
        logger.info(`Role "${role.name}" (${role._id}) already has custom permissions (${existingMappingsCount}). Skipping auto-sync to preserve edits.`);
      }
    }

    // 6.6 Self-healing: tenant (resident) roles must never hold admin-only permissions.
    // Communities created before this fix were seeded with `amenities:amenities` on
    // Resident Owner / Resident Tenant, which unlocked facility and maintenance admin APIs.
    const { TENANT_FORBIDDEN_PERMISSIONS } = await import('../features/organization/defaultRolePermissions.js');
    const forbiddenPerms = await PermissionModel.find({ name: { $in: TENANT_FORBIDDEN_PERMISSIONS } });
    if (forbiddenPerms.length) {
      const tenantRoles = await RoleModel.find({ isTenantRole: true }, { _id: 1, name: 1 });
      const tenantRoleIds = tenantRoles.map((r) => r._id);
      const removal = await RolePermissionModel.deleteMany({
        roleId: { $in: tenantRoleIds },
        permissionId: { $in: forbiddenPerms.map((p) => p._id) },
      });
      if (removal.deletedCount > 0) {
        tenantRoleIds.forEach((id) => rolePermissionService.cache.delete(id.toString()));
        logger.info(`Self-healed ${removal.deletedCount} admin-only permission grant(s) off tenant roles.`);
      }
    }

    // 6.7 Self-healing: Ensure existing memberships missing a status field get defaulted to 'Active'
    const OrgMembershipModel = (await import('../features/orgMembership/orgMembership.model.js')).default;
    await OrgMembershipModel.updateMany({ $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] }, { $set: { status: 'Active' } });
    logger.info('Self-healed memberships with missing status to "Active".');

    // 6.8 Self-healing: Ensure all existing workspaces have all default modules backfilled
    const WorkspaceModel = (await import('../features/workspace/workspace.model.js')).default;
    const workspacesList = await WorkspaceModel.find({});
    const { DEFAULT_MODULES } = await import('../features/workspace/workspace.service.js');
    
    const LEGACY_MODULE_KEYS = ['villas', 'users', 'roles', 'integrations', 'financial_suit', 'financials'];
    for (const ws of workspacesList) {
      let modified = false;
      if (!ws.modules) {
        ws.modules = [];
      }
      if (ws.modules.some(m => LEGACY_MODULE_KEYS.includes(m.moduleKey))) {
        ws.modules = ws.modules.filter(m => !LEGACY_MODULE_KEYS.includes(m.moduleKey));
        modified = true;
      }
      for (const defaultMod of DEFAULT_MODULES) {
        const hasModule = ws.modules.some(m => m.moduleKey === defaultMod.moduleKey);
        if (!hasModule) {
          ws.modules.push({ ...defaultMod });
          modified = true;
        }
      }
      if (modified) {
        await ws.save({ validateBeforeSave: false });
        logger.info(`Self-healed workspace "${ws.workspaceName}" (${ws._id}) by updating module array.`);
      }
    }

    // 6.9 Self-healing: Ensure platform orgs or unassigned orgs have initial feature keys
    const OrganizationModel = (await import('../features/organization/organization.model.js')).default;
    const orgsList = await OrganizationModel.find({});
    const defaultFeatureKeys = DEFAULT_MODULES.map(m => m.moduleKey);
    
    for (const org of orgsList) {
      org.allowedFeatures = Array.from(new Set([...(org.allowedFeatures || []), ...defaultFeatureKeys]));
      await org.save({ validateBeforeSave: false });
      logger.info(`Self-healed organization "${org.name}" (${org._id}) allowedFeatures.`);
    }

    // 6.10 Self-healing: Ensure all occupied units with no residents are marked as 'Vacant'
    const VillaModel = (await import('../features/villa/villa.model.js')).default;
    const occupiedVillasWithNoResidents = await VillaModel.find({
      status: 'Occupied',
      $or: [
        { residents: { $size: 0 } },
        { residents: { $exists: false } }
      ]
    });
    for (const villa of occupiedVillasWithNoResidents) {
      villa.status = 'Vacant';
      villa.primaryResidentId = null;
      villa.ownerId = null;
      await villa.save({ validateBeforeSave: false });
      logger.info(`Self-healed unit "${villa.unitNumber}" (${villa._id}) to "Vacant" since it has no residents.`);
    }

    logger.info('Permission synchronization and Super Admin bootstrapping finished successfully.');
  } catch (error) {
    logger.error('Failed to synchronize permissions and bootstrap Super Admin user:', error);
    throw error;
  }
};

export default syncPermissions;
