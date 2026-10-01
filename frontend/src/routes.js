import React from 'react'

// Lazy-loaded Components
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const ProfileView = React.lazy(() => import('./features/auth/views/ProfileView'))
const SampleFeature = React.lazy(() => import('./features/sampleFeature/SampleFeatureView'))
const RoleBuilder = React.lazy(() => import('./features/roleBuilder/RoleBuilderList'))
const UserList = React.lazy(() => import('./features/userManagement/UserList'))
const InvitationManagementView = React.lazy(
  () => import('./features/userManagement/views/InvitationManagementView'),
)
const NotificationView = React.lazy(() => import('./features/notification/views/NotificationView'))
const IntegrationHubView = React.lazy(
  () => import('./features/integrationHub/views/IntegrationHubView'),
)
const FeatureConfigWizard = React.lazy(
  () => import('./features/workspace/views/FeatureConfigWizard'),
)
const WorkspaceDetailsView = React.lazy(
  () => import('./features/workspace/views/WorkspaceDetailsView'),
)
const VillaManagementView = React.lazy(() => import('./features/villa/views/VillaManagementView'))
const OrganizationManager = React.lazy(
  () => import('./features/organization/views/OrganizationManager'),
)
const OrganizationDetails = React.lazy(
  () => import('./features/organization/views/OrganizationDetails'),
)

const PlatformBillingLayout = React.lazy(
  () => import('./features/platformBilling/views/PlatformBillingLayout'),
)
const AuditLogViewer = React.lazy(() => import('./features/auditLog/views/AuditLogViewer'))
const IssueReportsView = React.lazy(() => import('./features/issueReport/views/IssueReportsView'))
const NoticeBoardRedirector = React.lazy(
  () => import('./features/noticeBoard/views/NoticeBoardRedirector'),
)
const NoticeBoardDashboardView = React.lazy(
  () => import('./features/noticeBoard/views/NoticeBoardDashboardView'),
)
const NoticeBoardActiveView = React.lazy(
  () => import('./features/noticeBoard/views/NoticeBoardActiveView'),
)
const NoticeBoardManageView = React.lazy(
  () => import('./features/noticeBoard/views/NoticeBoardManageView'),
)
const PollDashboardView = React.lazy(() => import('./features/poll/views/PollDashboardView'))

// Amenities Views (New)
const AmenitiesRedirector = React.lazy(
  () => import('./features/amenities/views/AmenitiesRedirector'),
)
const DashboardView = React.lazy(() => import('./features/amenities/views/DashboardView'))
const AmenitiesMasterView = React.lazy(
  () => import('./features/amenities/views/AmenitiesMasterView'),
)
const ResidentDiscoverView = React.lazy(
  () => import('./features/amenities/views/ResidentDiscoverView'),
)
const ResidentBookingView = React.lazy(
  () => import('./features/amenities/views/ResidentBookingView'),
)
const AdminCalendarView = React.lazy(() => import('./features/amenities/views/AdminCalendarView'))
const ResidentCalendarView = React.lazy(
  () => import('./features/amenities/views/ResidentCalendarView'),
)
const ResidentWalletView = React.lazy(() => import('./features/amenities/views/ResidentWalletView'))
const ResidentHistoryView = React.lazy(
  () => import('./features/amenities/views/ResidentHistoryView'),
)
const SecurityScannerView = React.lazy(
  () => import('./features/amenities/views/SecurityScannerView'),
)

const SecurityLogsView = React.lazy(() => import('./features/amenities/views/SecurityLogsView'))
const AdminLedgersView = React.lazy(() => import('./features/amenities/views/AdminLedgersView'))
const AdminMaintenanceView = React.lazy(
  () => import('./features/amenities/views/AdminMaintenanceView'),
)

// Complaints Views (New)
const ComplaintsRedirector = React.lazy(
  () => import('./features/complaints/views/ComplaintRedirector'),
)
const ComplaintDashboard = React.lazy(
  () => import('./features/complaints/views/ComplaintDashboard'),
)
const CreateComplaint = React.lazy(() => import('./features/complaints/views/CreateComplaint'))
const MyComplaints = React.lazy(() => import('./features/complaints/views/MyComplaints'))
const ComplaintManagement = React.lazy(
  () => import('./features/complaints/views/ComplaintManagement'),
)
const StaffAndVendor = React.lazy(() => import('./features/complaints/views/StaffAndVendor'))
const AssigneeView = React.lazy(() => import('./features/complaints/views/Assignee'))
const CommunityIssueReportsView = React.lazy(
  () => import('./features/issueReport/views/CommunityIssueReportsView'),
)

// Visitor Management Views
const ResidentVisitorManagementView = React.lazy(
  () => import('./features/visitorManagement/views/ResidentVisitorManagementView'),
)
const AdminVisitorManagementViews = React.lazy(
  () => import('./features/visitorManagement/views/AdminVisitorManagementViews'),
)
const GuardVisitormanagementViews = React.lazy(
  () => import('./features/visitorManagement/views/GuardVisitormanagementViews'),
)
const VisitorContextManager = React.lazy(
  () => import('./features/visitorManagement/views/VisitorContextManager'),
)

// Financial Suite Views
const BillingView = React.lazy(() => import('./features/billing/views/BillingView'))
const AssessmentManagementView = React.lazy(
  () => import('./features/assessment/views/AssessmentManagementView'),
)
const DashboardDeepLinkRedirector = React.lazy(
  () => import('./views/dashboard/components/DashboardDeepLinkRedirector'),
)

/**
 * Application Routes configuration mapping paths to lazy-loaded components.
 */
export const OnboardingWizardView = React.lazy(
  () => import('./features/onboardingWizard/views/OnboardingWizardView'),
)

export const routes = [
  { path: '/onboarding-wizard', name: 'Onboarding Wizard', element: OnboardingWizardView },
  { path: '/onboarding', name: 'Data Import Wizard', element: OnboardingWizardView },
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/profile', name: 'Profile', element: ProfileView },
  {
    path: '/dashboard/community-notices/:id',
    name: 'Notice Deep Link',
    element: DashboardDeepLinkRedirector,
  },
  {
    path: '/dashboard/maintenance/:id',
    name: 'Maintenance Deep Link',
    element: DashboardDeepLinkRedirector,
  },
  {
    path: '/visitor-management',
    name: 'Visitor Management',
    element: VisitorContextManager,
    requiredPermission: ['visitor:resident', 'visitor:guard', 'visitor:admin'],
  },
  {
    path: '/visitor-management-resident',
    name: 'Visitor Passes',
    element: ResidentVisitorManagementView,
    requiredPermission: 'visitor:resident',
  },
  {
    path: '/visitor-management-admin',
    name: 'Visitor Admin',
    element: AdminVisitorManagementViews,
    requiredPermission: 'visitor:admin',
  },
  {
    path: '/visitor-management-guard',
    name: 'Gate Console',
    element: GuardVisitormanagementViews,
    requiredPermission: 'visitor:guard',
  },
  { path: '/users', name: 'User Management', element: UserList, requiredPermission: 'users:read' },
  {
    path: '/users/invitations',
    name: 'Invitation Management',
    element: InvitationManagementView,
    requiredPermission: 'users:read',
  },
  {
    path: '/villas',
    name: 'Unit Management',
    element: VillaManagementView,
    requiredPermission: 'villas:read',
  },
  { path: '/sample', name: 'Sample Feature', element: SampleFeature },
  {
    path: '/role-builder',
    name: 'Role Builder',
    element: RoleBuilder,
    requiredPermission: 'roles:read',
  },
  { path: '/notifications', name: 'Notifications', element: NotificationView },
  {
    path: '/integrations',
    name: 'Integration Hub',
    element: IntegrationHubView,
    requiredPermission: 'integrations:read',
  },
  {
    path: '/integration-hub',
    name: 'Integration Hub',
    element: IntegrationHubView,
    requiredPermission: 'integrations:read',
  },
  {
    path: '/integration',
    name: 'Integration Hub',
    element: IntegrationHubView,
    requiredPermission: 'integrations:read',
  },
  { path: '/workspace-setup', name: 'Workspace Setup', element: FeatureConfigWizard },
  { path: '/workspace/settings', name: 'Workspace Settings', element: WorkspaceDetailsView },
  {
    path: '/super-admin/organizations',
    name: 'Organization Manager',
    element: OrganizationManager,
    requirePlatform: true,
  },
  {
    path: '/super-admin/organizations/:organizationId',
    name: 'Organization Details',
    element: OrganizationDetails,
    requirePlatform: true,
  },

  {
    path: '/super-admin/crm',
    name: 'Platform Billing & CRM',
    element: PlatformBillingLayout,
    requirePlatform: true,
  },
  {
    path: '/super-admin/audit-logs',
    name: 'Audit Logs',
    element: AuditLogViewer,
    requirePlatform: true,
  },
  {
    path: '/super-admin/issue-reports',
    name: 'Issue Reports',
    element: IssueReportsView,
    requirePlatform: true,
  },
  { path: '/notices', name: 'Notice Board', element: NoticeBoardRedirector },
  {
    path: '/admin/notices/dashboard',
    name: 'Notice Dashboard',
    element: NoticeBoardDashboardView,
    requiredPermission: 'notices:dashboard',
  },
  {
    path: '/notices/board',
    name: 'Active Board',
    element: NoticeBoardActiveView,
    requiredPermission: 'notices:active_board',
  },
  {
    path: '/admin/notices/manage',
    name: 'Manage Notices',
    element: NoticeBoardManageView,
    requiredPermission: 'notices:manage_notices',
  },
  {
    path: '/notices/polls',
    name: 'Community Polls',
    element: PollDashboardView,
    requiredPermission: 'notices:polls',
  },

  // Amenities Dynamic Redirector
  { path: '/amenities', name: 'Amenities & Bookings', element: AmenitiesRedirector },

  // New Unified Amenities Routes
  // Dashboard – manage_bookings required (admin analytics)
  {
    path: '/admin/amenities/dashboard',
    name: 'Amenities Dashboard',
    element: DashboardView,
    requiredPermission: 'amenities:dashboard',
  },
  // Master – read required; create/update/delete enforced at component level
  {
    path: '/admin/amenities/master',
    name: 'Amenity Master',
    element: AmenitiesMasterView,
    requiredPermission: 'amenities:amenities',
  },
  // Calendar – manage_bookings (admin-only view of all bookings)
  {
    path: '/admin/amenities/calendar',
    name: 'Admin Calendar',
    element: AdminCalendarView,
    requiredPermission: 'amenities:admin_calander',
  },
  // Ledgers & Maintenance
  {
    path: '/admin/amenities/ledgers',
    name: 'Admin Ledgers',
    element: AdminLedgersView,
    requiredPermission: 'amenities:ledgers',
  },
  {
    path: '/admin/amenities/maintenance',
    name: 'Admin Maintenance',
    element: AdminMaintenanceView,
    requiredPermission: 'amenities:maintenance',
  },
  // Scanner / Settings / Logs – manage_bookings
  {
    path: '/admin/amenities/scanner',
    name: 'Security Scanner',
    element: SecurityScannerView,
    requiredPermission: 'amenities:scanner',
  },
  {
    path: '/admin/amenities/security-logs',
    name: 'Security Logs',
    element: SecurityLogsView,
    requiredPermission: 'amenities:security_logs',
  },
  // Resident – read lets them discover; book/wallet require amenities:book
  {
    path: '/resident/amenities/discover',
    name: 'Discover Amenities',
    element: ResidentDiscoverView,
    requiredPermission: 'amenities:discover',
  },
  {
    path: '/resident/amenities/calendar',
    name: 'My Bookings',
    element: ResidentCalendarView,
    requiredPermission: 'amenities:my_booking',
  },
  {
    path: '/resident/amenities/wallet',
    name: 'Digital Wallet',
    element: ResidentWalletView,
    requiredPermission: 'amenities:wallet',
  },

  // Legacy Routes (Kept for backward compatibility during migration)
  {
    path: '/admin/amenities',
    name: 'Amenity Management',
    element: AmenitiesMasterView,
    requiredPermission: 'amenities:amenities',
  },
  {
    path: '/resident/amenities',
    name: 'Book Amenities',
    element: ResidentDiscoverView,
    requiredPermission: 'amenities:discover',
  },
  {
    path: '/resident/amenities/book/:id',
    name: 'Book Amenity Form',
    element: ResidentBookingView,
    requiredPermission: 'amenities:my_booking',
  },

  // Complaints Unified Routes
  { path: '/complaints', name: 'Complaints & Maintenance', element: ComplaintsRedirector },
  {
    path: '/admin/complaints/dashboard',
    name: 'Complaints Dashboard',
    element: ComplaintDashboard,
    requiredPermission: 'complaints:dashboard',
  },
  {
    path: '/admin/complaints/create',
    name: 'Raise Ticket',
    element: CreateComplaint,
    requiredPermission: 'complaints:raise_ticket',
  },
  {
    path: '/admin/complaints/my-tickets',
    name: 'Track Requests',
    element: MyComplaints,
    requiredPermission: 'complaints:track_requests',
  },
  {
    path: '/admin/complaints/manage',
    name: 'Complaint Management',
    element: ComplaintManagement,
    requiredPermission: 'complaints:complaint_management',
  },
  {
    path: '/admin/complaints/staff',
    name: 'Staff & Vendors',
    element: StaffAndVendor,
    requiredPermission: 'complaints:staff',
  },
  {
    path: '/admin/complaints/assignee',
    name: 'Assignee',
    element: AssigneeView,
    requiredPermission: 'complaints:assignee',
  },
  {
    path: '/admin/complaints/issue-reports',
    name: 'Issue Reports',
    element: CommunityIssueReportsView,
    requiredPermission: 'complaints:complaint_management',
  },

  // Financial Suite Routes
  {
    path: '/billing',
    name: 'Billing & Invoices',
    element: BillingView,
    requiredPermission: [
      'billing:dashboard',
      'billing:assessment_manager',
      'billing:action_center',
    ],
  },
  {
    path: '/assessments',
    name: 'Assessment Manager',
    element: AssessmentManagementView,
    requiredPermission: 'billing:assessment_manager',
  },
]

export default routes
