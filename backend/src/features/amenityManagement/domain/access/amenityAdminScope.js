import { getPermissionsForUser } from '../../../../middlewares/rbac.middleware.js';
import { mapPermission } from '../../../../utils/permissionMapper.js';

const ADMIN_ROLE_NAMES = ['Super Admin', 'Platform Super Admin', 'Community Admin', 'Admin', 'SuperAdmin'];

export const BOOKING_ADMIN_PERMISSIONS = Object.freeze(['amenities:admin_calander', 'amenities:manage_bookings']);
export const GATE_STAFF_PERMISSIONS = Object.freeze([...BOOKING_ADMIN_PERMISSIONS, 'amenities:scanner']);

/**
 * Whether `user` holds any of `requiredPermissions` in the community being acted on.
 *
 * tenantContext resolves `user.role` and `user.permissions` for the requested
 * community, so those are authoritative. The database fallback (for callers that run
 * outside a request) is always scoped to `orgId`; permissions a user holds in another
 * community must never widen their scope here.
 *
 * @param {object} user - req.user (tenant-resolved)
 * @param {string[]} requiredPermissions
 * @param {string} [orgId] - community being acted on; defaults to user.orgId
 * @returns {Promise<boolean>}
 */
export const hasAmenityAdminScope = async (user, requiredPermissions = BOOKING_ADMIN_PERMISSIONS, orgId = null) => {
  if (!user) return false;
  if (user.isPlatform || user.isPlatformSuperAdmin || ADMIN_ROLE_NAMES.includes(user.role)) return true;

  const required = requiredPermissions.map(mapPermission);
  const grants = (perms) => perms.includes('*') || perms.map(mapPermission).some((p) => required.includes(p));

  if (Array.isArray(user.permissions)) return grants(user.permissions);

  const scopeOrgId = orgId || user.orgId;
  if (!scopeOrgId) return false;
  const permissions = await getPermissionsForUser({ ...user, id: user.id || user._id, roles: [] }, scopeOrgId);
  return Array.isArray(permissions) && grants(permissions);
};

export default hasAmenityAdminScope;
