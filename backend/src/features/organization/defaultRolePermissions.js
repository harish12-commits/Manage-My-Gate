/**
 * Default permissions for the non-admin roles every new community is created with.
 * Shared by organization creation and the E2E seeds so they can never drift apart.
 *
 * Amenity tiers follow the mobile Role Builder: residents get discover / my_booking /
 * wallet, guards get scanner / security_logs. `amenities:amenities` is the admin
 * "Amenity Master" permission and must never be granted to tenant roles.
 */
export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  'Resident Owner': [
    'villas:read', 'users:read',
    'amenities:discover', 'amenities:my_booking', 'amenities:wallet',
    'notices:read',
    'billing:action_center',
  ],
  'Resident Tenant': [
    'villas:read', 'users:read',
    'amenities:discover', 'amenities:my_booking', 'amenities:wallet',
    'notices:read',
    'billing:action_center',
  ],
  'Family Member': [
    'villas:read',
    'amenities:discover', 'amenities:my_booking', 'amenities:wallet',
    'notices:read', 'notices:active_board',
    'complaints:raise_ticket', 'complaints:track_requests',
    'visitor:resident',
    'billing:action_center',
    'billing:dashboard',
  ],
  'Security Guard': [
    'villas:read', 'users:read',
    'amenities:scanner', 'amenities:security_logs',
    'notices:read',
  ],
});

/** Admin-only amenity permissions that tenant (resident) roles must never hold. */
export const TENANT_FORBIDDEN_PERMISSIONS = Object.freeze(['amenities:amenities']);
