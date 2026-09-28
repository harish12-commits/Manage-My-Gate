import organizationRepository from './organization.repository.js';
import HttpError from '../../utils/httpError.utils.js';
import mongoose from 'mongoose';
import orgEventEmitter from './organization.events.js';
import { DEFAULT_ROLE_PERMISSIONS } from './defaultRolePermissions.js';


export class OrganizationService {
  async createOrganization(orgData, session) {
    const org = await organizationRepository.create(orgData, session);
    return org;
  }

  async getOrganizationById(id, session) {
    const org = await organizationRepository.findById(id, session);
    if (!org) {
      throw new HttpError(404, `Organization with ID ${id} not found.`);
    }
    return org;
  }

  async updateFeatures(orgId, requestingOrgId, featuresArray, userId = null, isPlatformUser = false, session = null) {
    if (orgId !== requestingOrgId && !isPlatformUser) {
      let isAuthorizedMember = false;
      if (userId) {
        const OrgMembership = (await import('../orgMembership/orgMembership.model.js')).default;
        const membership = await OrgMembership.findOne({ userId, orgId, status: 'Active' }).lean();
        if (membership) {
          isAuthorizedMember = true;
        }
      }
      if (!isAuthorizedMember) {
        throw new HttpError(403, 'Forbidden. You do not have permission to access another organization.');
      }
    }

    let localSession = null;
    if (!session) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
    }
    const currentSession = session || localSession;

    try {
      // 1. Validate organization exists
      await this.getOrganizationById(orgId, currentSession);

      // 2. Update allowedFeatures in Organization document
      const updatedOrg = await organizationRepository.updateAllowedFeatures(orgId, featuresArray, currentSession);

      // 3. Crucial Permission Linkage:
      // Dynamically import services to respect feature boundaries
      const roleService = (await import('../role/role.services.js')).default;
      const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
      const permissionService = (await import('../permission/permission.services.js')).default;

      // 4. Fetch the admin role for this orgId (try 'Community Admin', fallback to 'Admin' or any Admin role)
      let adminRole = await roleService.getRoleByName('Community Admin', orgId, currentSession);
      if (!adminRole) {
        adminRole = await roleService.getRoleByName('Admin', orgId, currentSession);
      }
      if (!adminRole) {
        const rolesResult = await roleService.getAllRoles(orgId, 1, 50);
        const roles = rolesResult?.data || [];
        adminRole = roles.find((r) => r.name && r.name.toLowerCase().includes('admin'));
      }
      if (!adminRole) {
        throw new HttpError(404, 'Admin role not found for this organization.');
      }

      // 5. Get all system permissions and filter them by features in the featuresArray
      const allPermissions = await permissionService.getAllPermissions();
      const targetPermissions = allPermissions.filter((perm) =>
        featuresArray.includes(perm.feature)
      );
      const granularPermissionIds = targetPermissions.map((perm) => perm._id.toString());

      // Ensure base UI permissions: ['users:read', 'roles:read', 'workspaces:read', 'workspaces:update'] are always included for Workspace Admin
      const basePermissions = allPermissions.filter((perm) =>
        ['users:read', 'roles:read', 'workspaces:read', 'workspaces:update'].includes(perm.name)
      );
      for (const basePerm of basePermissions) {
        const baseId = basePerm._id.toString();
        if (!granularPermissionIds.includes(baseId)) {
          granularPermissionIds.push(baseId);
        }
      }

      // 6. Update role permissions for the Workspace Admin role
      await rolePermissionService.updateRolePermissions(adminRole._id.toString(), granularPermissionIds, currentSession);

      if (localSession) {
        await localSession.commitTransaction();
      }

      // Generate a new token if userId is provided
      let token = null;
      let userPayload = null;
      if (userId) {
        const authService = (await import('../auth/auth.services.js')).default;
        const user = await authService.getUserById(userId);
        const { tokenPayload, permissions, availableWorkspaces } = await authService.getScopedTokenPayload(user, orgId);
        const { signToken } = await import('../../utils/jwt.utils.js');
        token = signToken(tokenPayload);
        userPayload = {
          id: user._id,
          email: user.email,
          username: user.username,
          role: tokenPayload.role,
          permissions: permissions,
          orgId: tokenPayload.orgId,
          orgName: updatedOrg.name,
          organizationName: updatedOrg.name,
          activeOrganizationName: updatedOrg.name,
          isPlatform: tokenPayload.isPlatform,
          availableWorkspaces,
        };
      }

      return token ? { organization: updatedOrg, token, user: userPayload } : updatedOrg;
    } catch (error) {
      if (localSession) {
        await localSession.abortTransaction();
      }
      throw error;
    } finally {
      if (localSession) {
        await localSession.endSession();
      }
    }
  }

  async getAllOrganizations(page = 1, limit = 10) {
    return await organizationRepository.findAllPaginated(Number(page), Number(limit));
  }

  async changeOrganizationStatus(orgId, status, requestingUserId = null, session = null) {
    const validStatuses = ['Draft', 'Active', 'Pending', 'Rejected'];
    if (!validStatuses.includes(status)) {
      throw new HttpError(400, `Invalid status. Must be one of ${validStatuses.join(', ')}.`);
    }

    let localSession = null;
    if (!session) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
    }
    const activeSession = session || localSession;

    try {
      // 1. Verify organization exists
      const org = await organizationRepository.findById(orgId, activeSession);
      if (!org) {
        throw new HttpError(404, `Organization with ID ${orgId} not found.`);
      }

      if (org.isPlatform === true) {
        throw new HttpError(403, 'Critical System Restriction: The System Platform cannot be blocked or modified.');
      }

      const oldStatus = org.status;

      // 2. Update status
      const updatedOrg = await organizationRepository.updateStatus(orgId, status, activeSession);

      if (localSession) {
        await localSession.commitTransaction();
      }

      // Emit decoupled status changed event outside transaction lifecycle
      orgEventEmitter.emit('ORG_STATUS_CHANGED', {
        actorId: requestingUserId,
        targetId: orgId,
        oldStatus,
        newStatus: status,
      });

      return updatedOrg;
    } catch (error) {
      if (localSession) {
        await localSession.abortTransaction();
      }
      throw error;
    } finally {
      if (localSession) {
        await localSession.endSession();
      }
    }
  }

  async checkNameAvailability(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, 'Organization name query parameter is required.');
    }
    const org = await organizationRepository.findByName(name.trim());
    return !org;
  }

  async setupWorkspace({ name, organizationType, contactEmail, contactPhone, expectedMemberCount, timezone, userId, features }) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, 'Organization name is required.');
    }
    const trimmedName = name.trim();

    // Enforce name uniqueness checks BEFORE starting the write transaction
    const existingOrg = await organizationRepository.findByName(trimmedName);
    if (existingOrg) {
      throw new HttpError(409, 'Conflict. Organization name already exists.');
    }

    const defaultFeatures = ['users', 'roles', 'integrations', 'villas', 'amenities', 'notices', 'complaints', 'visitor', 'billing'];
    const finalFeatures = Array.isArray(features) && features.length > 0 ? features : defaultFeatures;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newOrg = await organizationRepository.create({
        name: trimmedName,
        status: 'Active',
        organizationType: organizationType || 'Residential',
        contactEmail,
        contactPhone,
        expectedMemberCount,
        timezone: timezone || 'Asia/Kolkata',
        allowedFeatures: finalFeatures
      }, session);

      // 2. Create the default Roles and assign Permissions
      const roleService = (await import('../role/role.services.js')).default;
      const rolePermissionService = (await import('../rolePermission/rolePermission.services.js')).default;
      const permissionService = (await import('../permission/permission.services.js')).default;

      const allPermissions = await permissionService.getAllPermissions();

      // Helper function to get IDs by name list
      const getPermissionIds = (names) => {
        return allPermissions
          .filter(p => names.includes(p.name))
          .map(p => p._id.toString());
      };

      // Create Community Admin Role
      const adminRole = await roleService.createRole(
        { name: 'Community Admin', description: 'Gated community administrator with full access privileges.', orgId: newOrg._id, isTenantRole: false },
        session
      );

      let adminPermissionIds;
      if (Array.isArray(features) && features.length > 0) {
        const targetPermissions = allPermissions.filter(perm =>
          features.includes(perm.feature)
        );
        const granularIds = targetPermissions.map(p => p._id.toString());
        const basePermissions = allPermissions.filter(perm =>
          ['users:read', 'roles:read', 'workspaces:read', 'workspaces:update'].includes(perm.name)
        );
        for (const basePerm of basePermissions) {
          const bId = basePerm._id.toString();
          if (!granularIds.includes(bId)) {
            granularIds.push(bId);
          }
        }
        adminPermissionIds = granularIds;
      } else {
        adminPermissionIds = allPermissions.map(p => p._id.toString());
      }
      await rolePermissionService.updateRolePermissions(adminRole._id.toString(), adminPermissionIds, session);

      // Create Resident Owner Role
      const ownerRole = await roleService.createRole(
        { name: 'Resident Owner', description: 'Villa Owner residing in the community.', orgId: newOrg._id, isTenantRole: true },
        session
      );
      const ownerPerms = getPermissionIds(DEFAULT_ROLE_PERMISSIONS['Resident Owner']);
      await rolePermissionService.updateRolePermissions(ownerRole._id.toString(), ownerPerms, session);

      // Create Resident Tenant Role
      const tenantRole = await roleService.createRole(
        { name: 'Resident Tenant', description: 'Villa Tenant residing in the community.', orgId: newOrg._id, isTenantRole: true },
        session
      );
      const tenantPerms = getPermissionIds(DEFAULT_ROLE_PERMISSIONS['Resident Tenant']);
      await rolePermissionService.updateRolePermissions(tenantRole._id.toString(), tenantPerms, session);

      // Create Family Member Role
      const familyRole = await roleService.createRole(
        { name: 'Family Member', description: 'Family member of a resident.', orgId: newOrg._id, isTenantRole: true },
        session
      );
      const familyPerms = getPermissionIds(DEFAULT_ROLE_PERMISSIONS['Family Member']);
      await rolePermissionService.updateRolePermissions(familyRole._id.toString(), familyPerms, session);

      // Create Security Guard Role
      const guardRole = await roleService.createRole(
        { name: 'Security Guard', description: 'Security gate staff.', orgId: newOrg._id, isTenantRole: false },
        session
      );
      const guardPerms = getPermissionIds(DEFAULT_ROLE_PERMISSIONS['Security Guard']);
      await rolePermissionService.updateRolePermissions(guardRole._id.toString(), guardPerms, session);

      // 3. Create the Organization Membership linking user, org, and role
      const orgMembershipService = (await import('../orgMembership/orgMembership.services.js')).default;
      await orgMembershipService.createMembership(
        { userId, orgId: newOrg._id, roleIds: [adminRole._id], status: 'Active' },
        session
      );

      await session.commitTransaction();

      // Emit decoupled ORGANIZATION_CREATED event strictly after successful commit
      orgEventEmitter.emit('ORGANIZATION_CREATED', {
        organizationId: newOrg._id.toString(),
        organizationName: newOrg.name,
        creatorUserId: userId.toString(),
      });

      // Outside the write transaction, generate the fresh token context
      const authService = (await import('../auth/auth.services.js')).default;
      const user = await authService.getUserById(userId);
      
      const { tokenPayload, availableWorkspaces } = await authService.getScopedTokenPayload(user, newOrg._id.toString());
      const { signToken } = await import('../../utils/jwt.utils.js');
      const token = signToken(tokenPayload);

      return {
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: tokenPayload.role,
          permissions: tokenPayload.permissions,
          orgId: tokenPayload.orgId,
          orgName: newOrg.name,
          organizationName: newOrg.name,
          activeOrganizationName: newOrg.name,
          isPlatform: tokenPayload.isPlatform,
          availableWorkspaces,
        },
        availableWorkspaces,
      };
    } catch (error) {
      await session.abortTransaction();
      if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) {
        throw new HttpError(409, 'Conflict. Organization name already exists.');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateOrganizationName(id, name, session = null) {
    const trimmedName = name.trim();
    const existing = await organizationRepository.findByName(trimmedName, session);
    if (existing && existing._id.toString() !== id.toString()) {
      throw new HttpError(409, 'Organization name already exists.');
    }
    return await organizationRepository.updateName(id, trimmedName, session);
  }

  async getOrganizationDetails(orgId) {
    const result = await organizationRepository.findDetailsAndSummary(orgId);
    if (!result) {
      throw new HttpError(404, `Organization with ID ${orgId} not found.`);
    }
    return result;
  }

  async getOrganizationUsers(orgId, { page = 1, limit = 10, search = '', role = '', status = '' }) {
    await this.getOrganizationById(orgId);
    return await organizationRepository.findOrgUsersPaginated(orgId, { page, limit, search, role, status });
  }

  async getOrganizationUserDetails(orgId, userId) {
    await this.getOrganizationById(orgId);
    const userDetail = await organizationRepository.findOrgUserDetails(orgId, userId);
    if (!userDetail) {
      throw new HttpError(404, `User ${userId} not found in Organization ${orgId}.`);
    }
    return userDetail;
  }
}

export default new OrganizationService();

