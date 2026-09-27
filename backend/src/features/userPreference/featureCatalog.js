/**
 * System Feature Catalog
 * Central dynamic registry defining parent categories and child sub-features
 * directly mapped from the Web Application & Backend permissions.
 */
export const SYSTEM_FEATURE_CATALOG = [
  {
    categoryKey: 'visitor_management',
    categoryName: 'Visitor & Gate Security',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/visitor/resident-passes' },
    items: [
      { id: 'visitor_resident_passes', name: 'Resident Passes', permission: 'visitor:resident', iconName: 'BadgeCheck', colorBg: 'bg-sky-500/15', colorIcon: '#0284c7', route: '/(resident)/visitor/resident-passes' },
      { id: 'visitor_admin_dashboard', name: 'Admin Visitor Console', permission: 'visitor:admin', iconName: 'ContactRound', colorBg: 'bg-purple-500/15', colorIcon: '#8b5cf6', route: '/(resident)/visitor/admin' },
      { id: 'visitor_community_passes', name: 'All Community Passes', permission: 'visitor:admin', iconName: 'TicketCheck', colorBg: 'bg-cyan-500/15', colorIcon: '#06b6d4', route: '/(resident)/visitor/admin/community-passes' },
      { id: 'visitor_blacklist', name: 'Visitor Blacklist', permission: 'visitor:admin', iconName: 'ShieldX', colorBg: 'bg-rose-500/15', colorIcon: '#f43f5e', route: '/(resident)/visitor/admin/blacklist' },
      { id: 'visitor_admin_logs', name: 'Admin Gate Logs', permission: 'visitor:admin', iconName: 'History', colorBg: 'bg-amber-500/15', colorIcon: '#d97706', route: '/(resident)/visitor/admin-logs' },
      { id: 'visitor_gate_console', name: 'Gate Console', permission: 'visitor:guard', iconName: 'DoorOpen', colorBg: 'bg-emerald-500/15', colorIcon: '#10b981', route: '/(resident)/visitor/gate-console' }
    ]
  },
  {
    categoryKey: 'amenities_facilities',
    categoryName: 'Amenities & Booking',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/amenities/discover' },
    items: [
      { id: 'amenities_dashboard', name: 'Amenity Dashboard', permission: 'amenities:dashboard', iconName: 'Building2', colorBg: 'bg-indigo-500/15', colorIcon: '#6366f1', route: '/(resident)/amenities/dashboard' },
      { id: 'amenities_discover', name: 'Discover Amenities', permission: 'amenities:discover', iconName: 'Compass', colorBg: 'bg-orange-500/15', colorIcon: '#f97316', route: '/(resident)/amenities/discover' },
      { id: 'amenities_my_booking', name: 'My Bookings', permission: 'amenities:my_booking', iconName: 'CalendarCheck', colorBg: 'bg-blue-500/15', colorIcon: '#2563eb', route: '/(resident)/amenities/my-bookings' },
      { id: 'amenities_master', name: 'Amenity Master', permission: 'amenities:amenities', iconName: 'SlidersHorizontal', colorBg: 'bg-teal-500/15', colorIcon: '#0d9488', route: '/(resident)/amenities/admin-master' },
      { id: 'amenities_admin_calendar', name: 'Admin Calendar', permission: 'amenities:admin_calander', iconName: 'CalendarDays', colorBg: 'bg-pink-500/15', colorIcon: '#ec4899', route: '/(resident)/amenities/admin-calendar' },
      { id: 'amenities_ledgers', name: 'Ledgers & Accounts', permission: 'amenities:ledgers', iconName: 'Receipt', colorBg: 'bg-emerald-500/15', colorIcon: '#059669', route: '/(resident)/amenities/ledgers' },
      { id: 'amenities_maintenance', name: 'Maintenance Schedule', permission: 'amenities:maintenance', iconName: 'Wrench', colorBg: 'bg-orange-600/15', colorIcon: '#ea580c', route: '/(resident)/amenities/maintenance' },
      { id: 'amenities_scanner', name: 'Security Gate Scanner', permission: 'amenities:scanner', iconName: 'ScanLine', colorBg: 'bg-sky-500/15', colorIcon: '#0284c7', route: '/(resident)/amenities/scanner' },
      { id: 'amenities_security_logs', name: 'Security Access Logs', permission: 'amenities:security_logs', iconName: 'History', colorBg: 'bg-slate-500/15', colorIcon: '#475569', route: '/(resident)/amenities/security-logs' }
    ]
  },
  {
    categoryKey: 'complaints_helpdesk',
    categoryName: 'Complaints & Maintenance',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/complaints/my-tickets' },
    items: [
      { id: 'complaints_dashboard', name: 'Complaints Dashboard', permission: 'complaints:dashboard', iconName: 'BarChart3', colorBg: 'bg-purple-500/15', colorIcon: '#a855f7', route: '/(resident)/complaints/dashboard' },
      { id: 'complaints_raise_ticket', name: 'Raise Ticket', permission: 'complaints:raise_ticket', iconName: 'PlusCircle', colorBg: 'bg-red-500/15', colorIcon: '#ef4444', route: '/(resident)/complaints/raise-ticket' },
      { id: 'complaints_track_requests', name: 'Track My Tickets', permission: 'complaints:track_requests', iconName: 'Clock', colorBg: 'bg-amber-500/15', colorIcon: '#f59e0b', route: '/(resident)/complaints/my-tickets', badge: '1', badgeColor: 'bg-rose-500 text-white' },
      { id: 'complaints_complaint_management', name: 'Complaint Management', permission: 'complaints:complaint_management', iconName: 'Kanban', colorBg: 'bg-blue-500/15', colorIcon: '#3b82f6', route: '/(resident)/complaints/manage' },
      { id: 'complaints_staff', name: 'Staff & Vendors', permission: 'complaints:staff', iconName: 'Users2', colorBg: 'bg-emerald-500/15', colorIcon: '#10b981', route: '/(resident)/complaints/staff' },
      { id: 'complaints_assignee', name: 'Assignee Console', permission: 'complaints:assignee', iconName: 'UserCheck', colorBg: 'bg-teal-500/15', colorIcon: '#14b8a6', route: '/(resident)/complaints/assignee' }
    ]
  },
  {
    categoryKey: 'notice_board_polls',
    categoryName: 'Notice Board & Polls',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/community-engagement' },
    items: [
      { id: 'community_engagement', name: 'Community Engagement', permission: 'notices:polls', iconName: 'Megaphone', colorBg: 'bg-indigo-500/15', colorIcon: '#6366f1', route: '/(resident)/community-engagement', badge: 'NEW', badgeColor: 'bg-indigo-600 text-white' },
      { id: 'notices_active_board', name: 'Resident Feed', permission: 'notices:active_board', iconName: 'Users', colorBg: 'bg-emerald-500/15', colorIcon: '#10b981', route: '/(resident)/notices/active-board' },
      { id: 'community_engagement_manage', name: 'Manage Engagement', permission: 'notices:manage_notices', iconName: 'FileEdit', colorBg: 'bg-pink-500/15', colorIcon: '#ec4899', route: '/(resident)/community-engagement/ledger' }
    ]
  },
  {
    categoryKey: 'digital_wallet',
    categoryName: 'Digital Wallet & Ledger',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/billing/wallet' },
    items: [
      { id: 'billing_wallet', name: 'Digital Wallet', permission: 'billing:action_center', iconName: 'WalletCards', colorBg: 'bg-emerald-600/15', colorIcon: '#059669', route: '/(resident)/billing/wallet' },
      { id: 'financial_history', name: 'Financial History', permission: 'billing:action_center', iconName: 'Receipt', colorBg: 'bg-teal-500/15', colorIcon: '#0d9488', route: '/(resident)/billing/history' }
    ]
  },
  {
    categoryKey: 'financial_billing',
    categoryName: 'Billing & Invoices',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/billing' },
    items: [
      { id: 'billing_dashboard', name: 'Billing Dashboard', permission: 'billing:action_center', iconName: 'CreditCard', colorBg: 'bg-emerald-500/15', colorIcon: '#10b981', route: '/(resident)/billing', badge: 'Due', badgeColor: 'bg-amber-500 text-white' },
      { id: 'billing_my_dues', name: 'My Personal Dues', permission: 'billing:action_center', iconName: 'Receipt', colorBg: 'bg-rose-500/15', colorIcon: '#f43f5e', route: '/(resident)/billing/my-dues' },
      { id: 'billing_assessment_manager', name: 'Assessment Manager', permission: 'billing:assessment_manager', iconName: 'Calculator', colorBg: 'bg-indigo-500/15', colorIcon: '#6366f1', route: '/(resident)/admin/billing/assessments' },
      { id: 'billing_action_center', name: 'Billing Ledger', permission: 'billing:dashboard', iconName: 'FileSpreadsheet', colorBg: 'bg-cyan-600/15', colorIcon: '#0891b2', route: '/(resident)/admin/billing/ledger' }
    ]
  },
  {
    categoryKey: 'administration_security',
    categoryName: 'Administration & Security',
    actionButton: { label: 'View all', type: 'link', route: '/(resident)/admin/users' },
    items: [
      { id: 'admin_users', name: 'User Management', permission: 'users:read', iconName: 'Users', colorBg: 'bg-blue-500/15', colorIcon: '#2563eb', route: '/(resident)/admin/users' },
      { id: 'admin_villas', name: 'Unit & Villa Management', permission: 'villas:read', iconName: 'Home', colorBg: 'bg-teal-500/15', colorIcon: '#0d9488', route: '/(resident)/admin/villas' },
      { id: 'admin_role_builder', name: 'Role Builder & RBAC', permission: 'roles:read', iconName: 'ShieldCheck', colorBg: 'bg-rose-500/15', colorIcon: '#e11d48', route: '/(resident)/admin/role-builder' },
      { id: 'admin_workspace_settings', name: 'Workspace Settings', permission: 'workspaces:read', iconName: 'Settings', colorBg: 'bg-slate-500/15', colorIcon: '#475569', route: '/(resident)/admin/workspace-settings' },
      { id: 'admin_integrations', name: 'Integration Hub', permission: 'integrations:read', iconName: 'Layers', colorBg: 'bg-amber-500/15', colorIcon: '#f59e0b', route: '/(resident)/admin/integrations' }
    ]
  }
];

export const DEFAULT_ACTIVE_QUICK_ACTIONS = [
  'visitor_resident_passes',
  'billing_dashboard',
  'complaints_track_requests',
  'amenities_discover',
  'community_engagement'
];
