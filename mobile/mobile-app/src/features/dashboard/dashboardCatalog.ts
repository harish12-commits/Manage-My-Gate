export interface AppFeatureItem {
  id: string;
  name: string;
  subtitle: string;
  iconName: string;
  colorBg: string;
  colorIcon: string;
  iconShapeClass?: string;
  route?: string;
  categoryKey?: string;
  categoryName?: string;
  badge?: string;
  badgeColor?: string;
  permission?: string;
}

export const ALL_AVAILABLE_FEATURES: AppFeatureItem[] = [
  // 1. Visitor & Gate Security
  { id: 'visitor_resident_passes', name: 'Resident Passes', subtitle: 'Digital Verified Pass', iconName: 'TicketCheck', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/visitor', permission: 'visitor:resident', categoryKey: 'visitor_management', categoryName: 'Visitor & Gate Security' },
  { id: 'visitor_admin_dashboard', name: 'Admin Console', subtitle: 'Visitor Monitoring', iconName: 'MonitorCog', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/visitor/admin', permission: 'visitor:admin', categoryKey: 'visitor_management', categoryName: 'Visitor & Gate Security' },
  { id: 'visitor_community_passes', name: 'Community Passes', subtitle: 'Pass Registry', iconName: 'TicketCheck', colorBg: 'bg-indigo-50 dark:bg-indigo-950/40', colorIcon: '#6366F1', iconShapeClass: 'rounded-[18px]', route: '/(resident)/visitor/admin/community-passes', permission: 'visitor:admin', categoryKey: 'visitor_management', categoryName: 'Visitor & Gate Security' },
  { id: 'visitor_blacklist', name: 'Visitor Blacklist', subtitle: 'Restricted Registry', iconName: 'ShieldBan', colorBg: 'bg-rose-50 dark:bg-rose-950/40', colorIcon: '#DC2626', iconShapeClass: 'rounded-[18px]', route: '/(resident)/visitor/admin/blacklist', permission: 'visitor:admin', categoryKey: 'visitor_management', categoryName: 'Visitor & Gate Security' },
  { id: 'visitor_admin_logs', name: 'Admin Gate Logs', subtitle: 'Security Activity', iconName: 'History', colorBg: 'bg-slate-100 dark:bg-slate-800/40', colorIcon: '#475569', iconShapeClass: 'rounded-[18px]', route: '/(resident)/visitor/admin-logs', permission: 'visitor:admin', categoryKey: 'visitor_management', categoryName: 'Visitor & Gate Security' },
  { id: 'visitor_gate_console', name: 'Gate Console', subtitle: 'Access Control', iconName: 'DoorOpen', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/visitor/gate-console', permission: 'visitor:guard', categoryKey: 'visitor_management', categoryName: 'Visitor & Gate Security' },

  // 2. Amenities & Booking
  { id: 'amenities_discover', name: 'Discover Amenities', subtitle: 'Book Facility', iconName: 'Compass', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/discover', permission: 'amenities:discover', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_my_booking', name: 'My Bookings', subtitle: 'Active Reservations', iconName: 'CalendarCheck', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/my-bookings', permission: 'amenities:my_booking', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_master', name: 'Amenity Master', subtitle: 'Pricing & Slots', iconName: 'SlidersHorizontal', colorBg: 'bg-orange-50 dark:bg-orange-950/40', colorIcon: '#EA580C', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/admin-master', permission: 'amenities:amenities', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_admin_bookings', name: 'Booking Queue', subtitle: 'Approvals & Decisions', iconName: 'ClipboardCheck', colorBg: 'bg-amber-50 dark:bg-amber-950/40', colorIcon: '#D97706', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/admin-bookings', permission: 'amenities:admin_calander', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_settings', name: 'Amenity Settings', subtitle: 'Quota & Gate Rules', iconName: 'SlidersHorizontal', colorBg: 'bg-indigo-50 dark:bg-indigo-950/40', colorIcon: '#6366F1', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/settings', permission: 'amenities:settings', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_admin_calendar', name: 'Admin Calendar', subtitle: 'Master Schedule', iconName: 'CalendarCog', colorBg: 'bg-purple-50 dark:bg-purple-950/40', colorIcon: '#7C3AED', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/admin-calendar', permission: 'amenities:admin_calander', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_maintenance', name: 'Maintenance', subtitle: 'Facility Downtime', iconName: 'Wrench', colorBg: 'bg-orange-50 dark:bg-orange-950/40', colorIcon: '#EA580C', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/maintenance', permission: 'amenities:maintenance', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_dashboard', name: 'Amenity Dashboard', subtitle: 'Executive Analytics', iconName: 'LayoutDashboard', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/dashboard', permission: 'amenities:dashboard', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_ledgers', name: 'Ledgers', subtitle: 'Revenue & Refunds', iconName: 'BookOpenCheck', colorBg: 'bg-teal-50 dark:bg-teal-950/40', colorIcon: '#0D9488', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/ledgers', permission: 'amenities:ledgers', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_scanner', name: 'Security Scanner', subtitle: 'Gate Scanner', iconName: 'ScanQrCode', colorBg: 'bg-teal-50 dark:bg-teal-950/40', colorIcon: '#0D9488', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/scanner', permission: 'amenities:scanner', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },
  { id: 'amenities_security_logs', name: 'Security Logs', subtitle: 'Access Records', iconName: 'History', colorBg: 'bg-slate-100 dark:bg-slate-800/40', colorIcon: '#475569', iconShapeClass: 'rounded-[18px]', route: '/(resident)/amenities/security-logs', permission: 'amenities:security_logs', categoryKey: 'amenities_facilities', categoryName: 'Amenities & Booking' },

  // 3. Complaints & Maintenance
  { id: 'complaints_dashboard', name: 'Complaints Stats', subtitle: 'SLA Tracking', iconName: 'ChartBar', colorBg: 'bg-purple-50 dark:bg-purple-950/40', colorIcon: '#7C3AED', iconShapeClass: 'rounded-[18px]', route: '/(resident)/complaints/dashboard', permission: 'complaints:dashboard', categoryKey: 'complaints_helpdesk', categoryName: 'Complaints & Maintenance' },
  { id: 'complaints_raise_ticket', name: 'Raise Ticket', subtitle: 'Report Issue', iconName: 'TicketPlus', colorBg: 'bg-orange-50 dark:bg-orange-950/40', colorIcon: '#EA580C', iconShapeClass: 'rounded-[18px]', route: '/(resident)/complaints/raise-ticket', permission: 'complaints:raise_ticket', categoryKey: 'complaints_helpdesk', categoryName: 'Complaints & Maintenance' },
  { id: 'complaints_track_requests', name: 'Track Tickets', subtitle: 'Live Status', iconName: 'Route', colorBg: 'bg-indigo-50 dark:bg-indigo-950/40', colorIcon: '#6366F1', iconShapeClass: 'rounded-[18px]', route: '/(resident)/complaints/my-tickets', permission: 'complaints:track_requests', categoryKey: 'complaints_helpdesk', categoryName: 'Complaints & Maintenance', badge: '5', badgeColor: '#EF4444' },
  { id: 'complaints_complaint_management', name: 'Complaint Queue', subtitle: 'Admin Board', iconName: 'ListTodo', colorBg: 'bg-purple-50 dark:bg-purple-950/40', colorIcon: '#7C3AED', iconShapeClass: 'rounded-[18px]', route: '/(resident)/complaints/manage', permission: 'complaints:complaint_management', categoryKey: 'complaints_helpdesk', categoryName: 'Complaints & Maintenance' },
  { id: 'complaints_staff', name: 'Staff & Vendors', subtitle: 'Roster & Contacts', iconName: 'UsersRound', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/complaints/staff', permission: 'complaints:staff', categoryKey: 'complaints_helpdesk', categoryName: 'Complaints & Maintenance' },
  { id: 'complaints_assignee', name: 'Assignee Console', subtitle: 'Work Orders', iconName: 'UserCheck', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/complaints/assignee', permission: 'complaints:assignee', categoryKey: 'complaints_helpdesk', categoryName: 'Complaints & Maintenance' },

  // 4. Notice Board & Polls
  { id: 'community_engagement', name: 'Community Engagement', subtitle: 'Broadcasts & Polls Hub', iconName: 'Megaphone', colorBg: 'bg-indigo-50 dark:bg-indigo-950/40', colorIcon: '#6366F1', iconShapeClass: 'rounded-[18px]', route: '/(resident)/community-engagement', permission: 'notices:polls', categoryKey: 'notice_board_polls', categoryName: 'Notice Board', badge: 'NEW', badgeColor: '#6366F1' },
  { id: 'notices_active_board', name: 'Resident Feed', subtitle: 'Circulars & Live Polls', iconName: 'Users', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#10B981', iconShapeClass: 'rounded-[18px]', route: '/(resident)/notices/active-board', permission: 'notices:active_board', categoryKey: 'notice_board_polls', categoryName: 'Notice Board' },
  { id: 'community_engagement_manage', name: 'Manage Engagement', subtitle: 'Draft, Publish & Ledger', iconName: 'FilePenLine', colorBg: 'bg-pink-50 dark:bg-pink-950/40', colorIcon: '#DB2777', iconShapeClass: 'rounded-[18px]', route: '/(resident)/community-engagement/ledger', permission: 'notices:manage_notices', categoryKey: 'notice_board_polls', categoryName: 'Notice Board' },

  // 5. Digital Wallet & Ledger
  { id: 'billing_wallet', name: 'Digital Wallet', subtitle: 'Prepaid Top-Up', iconName: 'WalletCards', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/billing/wallet', permission: 'billing:action_center', categoryKey: 'digital_wallet', categoryName: 'Digital Wallet & Ledger' },
  { id: 'financial_history', name: 'Financial History', subtitle: 'Receipts & Transactions', iconName: 'Receipt', colorBg: 'bg-teal-50 dark:bg-teal-950/40', colorIcon: '#0D9488', iconShapeClass: 'rounded-[18px]', route: '/(resident)/billing/history', permission: 'billing:action_center', categoryKey: 'digital_wallet', categoryName: 'Digital Wallet & Ledger' },

  // 6. Financial Suite & Billing
  { id: 'billing_dashboard', name: 'Billing Hub', subtitle: 'Collection Overview', iconName: 'ChartPie', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/billing', permission: 'billing:action_center', categoryKey: 'financial_billing', categoryName: 'Financial Suite & Billing', badge: 'PAID', badgeColor: '#F59E0B' },
  { id: 'billing_my_dues', name: 'My Personal Dues', subtitle: 'Unit Liabilities', iconName: 'ReceiptIndianRupee', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/billing/my-dues', permission: 'billing:action_center', categoryKey: 'financial_billing', categoryName: 'Financial Suite & Billing' },
  { id: 'billing_my_invoices', name: 'My Invoices', subtitle: 'Dues & Payment History', iconName: 'FileText', colorBg: 'bg-indigo-50 dark:bg-indigo-950/40', colorIcon: '#6366F1', iconShapeClass: 'rounded-[18px]', route: '/(resident)/billing/my-dues', permission: 'billing:action_center', categoryKey: 'financial_billing', categoryName: 'Financial Suite & Billing' },
  { id: 'billing_assessment_manager', name: 'Assessments', subtitle: 'Levy Generation', iconName: 'Calculator', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/billing/assessments', permission: 'billing:assessment_manager', categoryKey: 'financial_billing', categoryName: 'Financial Suite & Billing' },
  { id: 'billing_action_center', name: 'Action Center', subtitle: 'Amenities & Billing Ledger', iconName: 'BookOpenCheck', colorBg: 'bg-teal-50 dark:bg-teal-950/40', colorIcon: '#0D9488', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/billing/ledger', permission: 'billing:dashboard', categoryKey: 'financial_billing', categoryName: 'Financial Suite & Billing', badge: 'ADMIN', badgeColor: '#0D9488' },

  // 6. Administration & Security
  { id: 'admin_users', name: 'User Management', subtitle: 'Residents & Staff', iconName: 'UserRoundCog', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/users', permission: 'users:read', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_villas', name: 'Unit Management', subtitle: 'Blocks & Villas', iconName: 'House', colorBg: 'bg-emerald-50 dark:bg-emerald-950/40', colorIcon: '#16A34A', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/villas', permission: 'villas:read', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_role_builder', name: 'Role Builder', subtitle: 'RBAC Matrices', iconName: 'ShieldCheck', colorBg: 'bg-purple-50 dark:bg-purple-950/40', colorIcon: '#7C3AED', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/role-builder', permission: 'roles:read', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_workspace_settings', name: 'Workspace Settings', subtitle: 'Tenant Rules', iconName: 'Settings2', colorBg: 'bg-slate-100 dark:bg-slate-800/40', colorIcon: '#475569', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/workspace-settings', permission: 'workspaces:read', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_app_settings', name: 'App Settings', subtitle: 'Preferences & Themes', iconName: 'SlidersHorizontal', colorBg: 'bg-slate-100 dark:bg-slate-800/40', colorIcon: '#475569', iconShapeClass: 'rounded-[18px]', route: '/(resident)/settings', permission: 'settings:read', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_integrations', name: 'Integration Hub', subtitle: 'API & Webhooks', iconName: 'Workflow', colorBg: 'bg-teal-50 dark:bg-teal-950/40', colorIcon: '#0D9488', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/integrations', permission: 'integrations:read', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_organizations', name: 'Org Manager', subtitle: 'Platform Tenancy', iconName: 'Building', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/organizations', permission: 'platform:super_admin', categoryKey: 'administration_security', categoryName: 'Administration & Security' },
  { id: 'admin_audit_logs', name: 'Audit Logs', subtitle: 'Security Activity', iconName: 'History', colorBg: 'bg-slate-100 dark:bg-slate-800/40', colorIcon: '#475569', iconShapeClass: 'rounded-[18px]', route: '/(resident)/admin/audit-logs', permission: 'platform:super_admin', categoryKey: 'administration_security', categoryName: 'Administration & Security' },

  // 7. Community & Directory
  { id: 'community_directory', name: 'Directory', subtitle: 'Resident Directory', iconName: 'ContactRound', colorBg: 'bg-blue-50 dark:bg-blue-950/40', colorIcon: '#2563EB', iconShapeClass: 'rounded-[18px]', route: '/(resident)/directory', categoryKey: 'community_directory', categoryName: 'Community' },
];

export const REAL_APP_FEATURES = ALL_AVAILABLE_FEATURES;

export const DEFAULT_8_QUICK_ACTIONS = [
  'billing_dashboard',
  'community_directory',
  'visitor_resident_passes',
  'community_engagement',
  'amenities_discover',
  'complaints_track_requests',
];

export const DEFAULT_6_QUICK_ACTIONS = DEFAULT_8_QUICK_ACTIONS;
export const DEFAULT_5_QUICK_ACTIONS = DEFAULT_8_QUICK_ACTIONS;

export const ROLE_DEFAULT_QUICK_ACTIONS: Record<string, string[]> = {
  admin: [
    'visitor_admin_dashboard',
    'billing_action_center',
    'admin_users',
    'admin_villas',
    'amenities_dashboard',
    'community_engagement_manage',
    'complaints_complaint_management',
    'admin_workspace_settings',
  ],
  guard: [
    'visitor_gate_console',
    'amenities_scanner',
    'community_engagement',
    'complaints_track_requests',
    'complaints_raise_ticket',
    'amenities_security_logs',
    'visitor_admin_logs',
    'visitor_blacklist',
  ],
  resident: [
    'visitor_resident_passes',
    'billing_dashboard',
    'billing_my_dues',
    'amenities_discover',
    'community_engagement',
    'complaints_raise_ticket',
    'notices_active_board',
    'complaints_track_requests',
  ],
};

/**
 * Returns role-appropriate default quick action feature IDs based on user persona
 */
export const getRoleDefaultQuickActions = (user: any): string[] => {
  const rawRole =
    user?.role ||
    (user as any)?.activeRole ||
    (Array.isArray((user as any)?.roles)
      ? typeof (user as any).roles[0] === 'string'
        ? (user as any).roles[0]
        : (user as any).roles[0]?.name
      : '') ||
    '';
  const roleName = String(rawRole).toLowerCase();

  if (roleName.includes('guard') || roleName.includes('security')) {
    return ROLE_DEFAULT_QUICK_ACTIONS.guard;
  }

  if (roleName.includes('admin') || user?.isPlatform === true) {
    return ROLE_DEFAULT_QUICK_ACTIONS.admin;
  }

  return ROLE_DEFAULT_QUICK_ACTIONS.resident;
};

export { isFeatureAllowedForUser } from '@/src/utils/rbac';
