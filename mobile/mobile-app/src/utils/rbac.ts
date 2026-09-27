import { AppFeatureItem } from '../features/dashboard/dashboardCatalog';

export interface UserLike {
  id?: string;
  _id?: string;
  role?: string;
  activeRole?: string;
  roles?: any[];
  permissions?: string[];
  allowedFeatures?: string[];
  isPlatform?: boolean;
}

/**
 * Normalizes and extracts the active role name from user session object
 */
export const getUserRoleName = (user: UserLike | null | undefined): string => {
  if (!user) return '';
  if (user.role && typeof user.role === 'string') {
    return user.role.trim();
  }
  if (user.activeRole && typeof user.activeRole === 'string') {
    return user.activeRole.trim();
  }
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const firstRole = user.roles[0];
    if (typeof firstRole === 'string') return firstRole.trim();
    if (typeof firstRole === 'object' && firstRole?.name) return String(firstRole.name).trim();
  }
  return '';
};

/**
 * Determines whether user holds administrative privileges (SuperAdmin or Community Admin)
 */
export const checkIsAdmin = (user: UserLike | null | undefined): boolean => {
  if (!user) return false;
  if (user.isPlatform === true) return true;

  const permissions = user.permissions || [];
  if (
    permissions.includes('platform:super_admin') ||
    permissions.includes('*') ||
    permissions.includes('all') ||
    permissions.includes('admin:*') ||
    permissions.includes('owner:*')
  ) {
    return true;
  }

  const roleName = getUserRoleName(user).toLowerCase();
  const adminRoleNames = [
    'platform super admin',
    'superadmin',
    'super admin',
    'community admin',
    'admin',
    'administrator',
  ];

  return adminRoleNames.includes(roleName);
};

/**
 * Checks whether user holds Security Guard / Security role
 */
export const checkIsSecurityRole = (user: UserLike | null | undefined): boolean => {
  if (!user) return false;
  const roleName = getUserRoleName(user).toLowerCase();
  const securityRoleKeywords = [
    'security guard',
    'security',
    'guard',
    'security supervisor',
    'gate guard',
    'security officer',
    'gatekeeper',
  ];
  if (securityRoleKeywords.some((keyword) => roleName.includes(keyword))) {
    return true;
  }

  const permissions = user.permissions || [];
  return (
    permissions.includes('visitor:guard') ||
    permissions.includes('visitor:admin') ||
    permissions.includes('amenities:scanner') ||
    permissions.includes('amenities:security_logs') ||
    permissions.includes('visitor_gate_console')
  );
};

// Permission synonyms and equivalencies mapping for Role Builder permission keys
const PERMISSION_SYNONYMS: Record<string, string[]> = {
  // Visitor & Gate Security
  'visitor:guard': ['visitor:guard', 'visitor.guard', 'visitor:admin', 'visitor', 'gate:console', 'visitor_gate_console'],
  'visitor:admin': ['visitor:admin', 'visitor.admin', 'visitor:guard', 'visitor', 'visitor_admin_dashboard', 'visitor_community_passes', 'visitor_admin_logs', 'visitor_gate_console', 'visitor_invite'],
  'visitor:resident': ['visitor:resident', 'visitor.resident', 'visitor', 'visitor_resident_passes', 'visitor_passes', 'visitor:view', 'visitor:read', 'visitor_gate_console', 'visitor_invite'],

  // Notice Board
  'notices:active_board': ['notices:active_board', 'notices:read', 'notices.read', 'notices:view', 'notices.view', 'notices', 'notice_board'],
  'notices:dashboard': ['notices:dashboard', 'notices:read', 'notices.read', 'notices:view', 'notices'],
  'notices:manage_notices': ['notices:manage_notices', 'notices:create', 'notices:update', 'notices.create', 'notices.update', 'notices'],
  'notices:polls': ['notices:polls', 'notices:read', 'notices.polls', 'notices'],

  // Complaints & Maintenance
  'complaints:track_requests': ['complaints:track_requests', 'complaints:raise_ticket', 'complaints:view', 'complaints.view', 'complaints:read', 'complaints.read', 'complaints:create', 'complaints'],
  'complaints:raise_ticket': ['complaints:raise_ticket', 'complaints:create', 'complaints.create', 'complaints:track_requests', 'complaints'],
  'complaints:dashboard': ['complaints:dashboard', 'complaints:view', 'complaints:reports', 'complaints'],
  'complaints:complaint_management': ['complaints:complaint_management', 'complaints:update', 'complaints:assign', 'complaints'],
  'complaints:staff': ['complaints:staff', 'complaints:update', 'complaints'],
  'complaints:assignee': ['complaints:assignee', 'complaints:update', 'complaints'],

  // Amenities & Facilities
  'amenities:scanner': ['amenities:scanner', 'amenities.scanner', 'amenities:guard', 'amenities.guard'],
  'amenities:security_logs': ['amenities:security_logs', 'amenities.security_logs', 'amenities:guard', 'amenities.guard'],
  'amenities:discover': ['amenities:discover', 'amenities.discover', 'amenities:resident', 'amenities.resident', 'amenities:read', 'amenities.read'],
  'amenities:my_booking': ['amenities:my_booking', 'amenities.my_booking', 'amenities:book', 'amenities.book', 'amenities:resident', 'amenities.resident'],
  'amenities:wallet': ['amenities:wallet', 'amenities.wallet', 'amenities:resident', 'amenities.resident'],
  'amenities:amenities': ['amenities:amenities', 'amenities.amenities', 'amenities:admin', 'amenities.admin', 'amenities:create', 'amenities:update', 'amenities:delete'],
  'amenities:admin_calander': ['amenities:admin_calander', 'amenities.admin_calander', 'amenities:admin', 'amenities.admin'],
  'amenities:maintenance': ['amenities:maintenance', 'amenities.maintenance', 'amenities:admin', 'amenities.admin'],
  'amenities:settings': ['amenities:settings', 'amenities.settings', 'amenities:admin', 'amenities.admin'],
  'amenities:dashboard': ['amenities:dashboard', 'amenities.dashboard', 'amenities:admin', 'amenities.admin'],
  'amenities:ledgers': ['amenities:ledgers', 'amenities.ledgers', 'amenities:admin', 'amenities.admin'],

  // Billing & Invoices
  'billing:action_center': ['billing:action_center', 'billing:dashboard', 'billing:view', 'billing:read', 'billing', 'financial_history', 'billing_wallet'],
  'billing:assessment_manager': ['billing:assessment_manager', 'billing:dashboard', 'billing'],

  // Administration & Security
  'villas:read': ['villas:read', 'villas.read', 'villas:view', 'villas', 'units:read', 'admin_villas'],
  'users:read': ['users:read', 'users.read', 'users:view', 'users', 'admin_users'],
  'roles:read': ['roles:read', 'roles.read', 'roles:view', 'roles', 'admin_role_builder'],
  'workspaces:read': ['workspaces:read', 'workspaces.read', 'workspaces:view', 'workspaces', 'admin_workspaces', 'admin_workspace_settings'],
  'settings:read': ['settings:read', 'settings.read', 'settings:view', 'settings', 'admin_app_settings'],
  'integrations:read': ['integrations:read', 'integrations.read', 'integrations:view', 'integrations', 'admin_integrations'],
};

/**
 * Checks if user's permissions array from Role Builder matches the given item permission or feature ID
 */
const matchesUserPermissions = (
  itemPermission: string | undefined,
  itemId: string,
  userPermissions: string[]
): boolean => {
  if (!userPermissions || userPermissions.length === 0) return false;

  // Wildcard / SuperAdmin permissions
  if (userPermissions.includes('*') || userPermissions.includes('all') || userPermissions.includes('platform:super_admin')) {
    return true;
  }

  // Exact ID match
  if (userPermissions.includes(itemId)) return true;

  // Exact permission string match
  if (itemPermission && userPermissions.includes(itemPermission)) return true;

  // Normalized dot vs colon match (e.g., 'notices.read' matches 'notices:read')
  if (itemPermission && typeof itemPermission === 'string') {
    const dotPerm = itemPermission.replace(':', '.');
    const colonPerm = itemPermission.replace('.', ':');
    if (userPermissions.includes(dotPerm) || userPermissions.includes(colonPerm)) return true;

    // Check module level match (e.g. 'notices' in permissions array)
    const modulePrefix = itemPermission.split(/[:.]/)[0];
    if (userPermissions.includes(modulePrefix)) return true;

    // Check synonym map
    const synonyms = PERMISSION_SYNONYMS[itemPermission] || [];
    if (synonyms.some((syn) => userPermissions.includes(syn))) return true;
  }

  return false;
};

// Features strictly reserved for resident self-service (hidden from Admin and Guard consoles)
// NOTE: Digital Wallet & Ledger features (wallet, dues, history) are NOT resident-only — see WALLET_LEDGER_FEATURE_IDS.
export const RESIDENT_ONLY_FEATURE_IDS = new Set([
  'visitor_resident_passes',
  'visitor_passes',
]);

// Digital Wallet & Ledger features (Wallet, Dues & Invoices, Financial History). These are available to
// EVERY role (Admin, Guard, Resident, custom) that is granted 'billing:action_center' in Role Builder.
export const WALLET_LEDGER_FEATURE_IDS = new Set([
  'billing_wallet',
  'financial_history',
  'amenities_wallet',
  'billing_my_dues',
  'billing_my_invoices',
]);

// Exact Role Builder grants ('Digital Wallet' = billing:action_center). Deliberately excludes billing:dashboard synonyms so that
// only an explicit Digital Wallet grant exposes these tiles.
const WALLET_LEDGER_GRANTS = ['billing:action_center', 'billing.action_center', 'billing'];

// 'amenities:wallet' is the legacy wallet permission still carried by seeded Resident Owner / Tenant roles.
// It unlocks the wallet tiles only — never billing dues/invoices (the backend rejects those without a billing grant).
const LEGACY_WALLET_GRANTS = ['amenities:wallet', 'amenities.wallet'];
const LEGACY_WALLET_FEATURE_IDS = new Set(['billing_wallet', 'financial_history', 'amenities_wallet']);

const hasWalletLedgerGrant = (itemId: string, permissions: string[]): boolean => {
  if (permissions.includes(itemId) || WALLET_LEDGER_GRANTS.some((grant) => permissions.includes(grant))) return true;
  return LEGACY_WALLET_FEATURE_IDS.has(itemId) && LEGACY_WALLET_GRANTS.some((grant) => permissions.includes(grant));
};

// Features strictly reserved for gate security hardware (hidden from Admin and Resident consoles)
export const GUARD_ONLY_FEATURE_IDS = new Set<string>([]);

// Features allowed for Security Guard
const FALLBACK_SECURITY_FEATURE_IDS = new Set([
  'visitor_gate_console',
  'visitor_invite',
  'visitor_admin_logs',
  'amenities_scanner',
  'amenities_security_logs',
  'notices_active_board',
  'complaints_track_requests',
  'complaints_raise_ticket',
  'admin_villas',
]);

const FALLBACK_SECURITY_PERMISSIONS = new Set([
  'visitor:guard',
  'visitor:admin',
  'visitor:resident',
  'amenities:scanner',
  'amenities:security_logs',
  'notices:active_board',
  'notices:read',
  'complaints:track_requests',
  'complaints:raise_ticket',
  'villas:read',
]);

const FALLBACK_RESIDENT_FEATURE_IDS = new Set([
  'visitor_resident_passes',
  'visitor_gate_pass',
  'visitor_gate_console',
  'visitor_invite',
  'billing_dashboard',
  'billing_my_dues',
  'billing_my_invoices',
  'billing_wallet',
  'financial_history',
  'amenities_discover',
  'amenities_my_booking',
  'amenities_wallet',
  'complaints_raise_ticket',
  'complaints_track_requests',
  'notices_active_board',
  'notices_polls',
  'admin_villas',
]);

const FALLBACK_RESIDENT_PERMISSIONS = new Set([
  'visitor:resident',
  'billing:action_center',
  'amenities:discover',
  'amenities:my_booking',
  'amenities:wallet',
  'complaints:raise_ticket',
  'complaints:track_requests',
  'notices:active_board',
  'notices:polls',
  'notices:read',
  'villas:read',
]);

/**
 * Primary RBAC resolver: strictly respects Role Builder permissions and persona boundaries.
 */
export const isFeatureAllowedForUser = (
  item: { id: string; permission?: string; categoryKey?: string },
  user: UserLike | null | undefined
): boolean => {
  if (!user || !item) return false;
  if (item.id === 'admin_organizations' || item.id === 'admin_audit_logs') {
    return user.isPlatform === true || Boolean(user.permissions && (user.permissions.includes('platform:super_admin') || user.permissions.includes('*')));
  }

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  // Super Admin / Platform bypass (full system visibility)
  if (user.isPlatform === true || permissions.includes('platform:super_admin') || permissions.includes('*')) {
    return true;
  }

  // Digital Wallet & Ledger is role-agnostic: when Role Builder permissions are present they are the only source of truth.
  if (WALLET_LEDGER_FEATURE_IDS.has(item.id) && permissions.length > 0) {
    return hasWalletLedgerGrant(item.id, permissions);
  }

  const isAdmin = checkIsAdmin(user);
  const isSecurity = checkIsSecurityRole(user);

  // 1. Community Admin persona: strictly exclude resident self-service and guard hardware equipment
  if (isAdmin) {
    if (RESIDENT_ONLY_FEATURE_IDS.has(item.id)) return false;
    if (GUARD_ONLY_FEATURE_IDS.has(item.id)) return false;

    // In GlobalNavModal, keep role-specific amenity item filtering (items prefixed with 'a-')
    if (item.id && item.id.startsWith('a-')) {
      if (['a-discover', 'a-bookings', 'a-wallet', 'a-scanner'].includes(item.id)) {
        if (permissions.length > 0) {
          return permissions.includes(item.permission || '') || permissions.includes('*');
        }
      }
    }

    // Strict evaluation for Amenities: Admin must have the explicit admin amenity permission
    if (item.permission && item.permission.startsWith('amenities:') && permissions.length > 0) {
      return matchesUserPermissions(item.permission, item.id, permissions);
    }

    return true;
  }

  // 2. Security Guard persona: strictly exclude admin consoles and resident booking flows
  if (isSecurity) {
    if (RESIDENT_ONLY_FEATURE_IDS.has(item.id)) return false;
    if (FALLBACK_SECURITY_FEATURE_IDS.has(item.id)) return true;
    if (item.permission && FALLBACK_SECURITY_PERMISSIONS.has(item.permission)) {
      return !item.permission.startsWith('amenities:') || item.permission === 'amenities:scanner' || item.permission === 'amenities:security_logs';
    }
    return false;
  }

  // 3. Resident persona: strictly exclude admin consoles and guard hardware
  if (GUARD_ONLY_FEATURE_IDS.has(item.id)) return false;

  if (item.permission && item.permission.startsWith('amenities:')) {
    const isResidentAmenity =
      item.permission === 'amenities:discover' ||
      item.permission === 'amenities:my_booking' ||
      item.permission === 'amenities:wallet' ||
      item.id === 'amenities_discover' ||
      item.id === 'amenities_my_booking' ||
      item.id === 'amenities_wallet';
    if (!isResidentAmenity) {
      if (permissions.length > 0 && matchesUserPermissions(item.permission, item.id, permissions)) {
        return true;
      }
      return false;
    }
    if (permissions.length > 0) {
      return matchesUserPermissions(item.permission, item.id, permissions);
    }
    return true;
  }

  // Strict evaluation of permissions assigned in Role Builder (when permissions array is populated)
  if (permissions.length > 0) {
    return matchesUserPermissions(item.permission, item.id, permissions);
  }

  // 4. Fallback persona validation when explicit permissions array is not provided:
  const roleName = getUserRoleName(user).toLowerCase();

  // 4a. Staff / Assignee persona
  if (roleName.includes('staff') || roleName.includes('assignee') || roleName.includes('vendor')) {
    const staffAllowed = [
      'complaints_assignee',
      'complaints_track_requests',
      'complaints_raise_ticket',
      'notices_active_board',
    ];
    return staffAllowed.includes(item.id);
  }

  // 4b. Facility / Community Manager persona
  if (roleName.includes('facility') || roleName.includes('manager')) {
    const managerAllowed = [
      'amenities_dashboard',
      'amenities_admin_calendar',
      'amenities_ledgers',
      'amenities_master',
      'amenities_maintenance',
      'amenities_scanner',
      'amenities_security_logs',
      'amenities_action_center',
      'complaints_dashboard',
      'complaints_complaint_management',
      'complaints_staff',
      'complaints_assignee',
      'notices_dashboard',
      'notices_manage_notices',
      'visitor_admin_dashboard',
      'visitor_community_passes',
      'visitor_admin_logs',
      'billing_dashboard',
      'billing_action_center',
      'billing_my_invoices',
    ];
    return managerAllowed.includes(item.id);
  }

  // 4c. Resident / Tenant / Owner persona
  const isResidentRole =
    !roleName ||
    roleName.includes('resident') ||
    roleName.includes('tenant') ||
    roleName.includes('member') ||
    roleName.includes('owner');

  if (isResidentRole) {
    if (FALLBACK_RESIDENT_FEATURE_IDS.has(item.id)) return true;
    if (item.permission && FALLBACK_RESIDENT_PERMISSIONS.has(item.permission)) return true;
    return false;
  }

  return false;
};


/**
 * Returns role-appropriate default quick action feature IDs (6 slots)
 */
export const getDefaultQuickActionsForUser = (user: UserLike | null | undefined): string[] => {
  if (checkIsSecurityRole(user)) {
    return [
      'visitor_gate_console',
      'amenities_scanner',
      'notices_active_board',
      'complaints_track_requests',
      'complaints_raise_ticket',
      'amenities_security_logs',
    ];
  }

  if (checkIsAdmin(user)) {
    return [
      'admin_users',
      'admin_villas',
      'visitor_admin_dashboard',
      'billing_action_center',
      'notices_manage_notices',
      'amenities_dashboard',
    ];
  }

  // Default Resident Quick Actions (6 slots)
  return [
    'visitor_resident_passes',
    'billing_dashboard',
    'complaints_track_requests',
    'amenities_discover',
    'notices_active_board',
    'complaints_raise_ticket',
  ];
};

