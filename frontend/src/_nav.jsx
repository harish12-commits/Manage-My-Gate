import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilLockLocked,
  cilPeople,
  cilApps,
  cilShieldAlt,
  cilList,
  cilHome,
  cilBuilding,
  cilCalendar,
  cilQrCode,
  cilSpeedometer,
  cilSettings,
  cilWallet,
  cilSearch,
  cilWarning,
} from '@coreui/icons'
import { CNavItem, CNavTitle, CNavGroup } from '@coreui/react'

/**
 * Sidebar Navigation Configuration
 * Contains only active features for the enterprise RBAC system.
 */
const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Workspace Settings',
    to: '/workspace/settings',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    requiredPermission: 'workspaces:read',
  },
  {
    component: CNavTitle,
    name: 'Features',
  },
  {
    component: CNavItem,
    name: 'Visitor Management',
    to: '/visitor-management',
    icon: <CIcon icon={cilQrCode} customClassName="nav-icon" />,
    requiredPermission: ['visitor:resident', 'visitor:guard', 'visitor:admin'],
  },
  {
    component: CNavGroup,
    name: 'Administration & Security',
    icon: <CIcon icon={cilShieldAlt} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Unit Management',
        to: '/villas',
        icon: <CIcon icon={cilHome} customClassName="nav-icon" />,
        requiredPermission: 'villas:read',
      },
      {
        component: CNavItem,
        name: 'User Management',
        to: '/users',
        icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
        requiredPermission: 'users:read',
      },
      {
        component: CNavItem,
        name: 'Invitations',
        to: '/users/invitations',
        requiredPermission: 'users:read',
      },
      {
        component: CNavItem,
        name: 'Role Builder',
        to: '/role-builder',
        icon: <CIcon icon={cilLockLocked} customClassName="nav-icon" />,
        requiredPermission: 'roles:read',
      },
      {
        component: CNavItem,
        name: 'Integration Hub',
        to: '/integrations',
        icon: <CIcon icon={cilApps} customClassName="nav-icon" />,
        requiredPermission: 'integrations:read',
      },
    ],
  },
  {
    component: CNavItem,
    name: 'Amenities & Bookings',
    to: '/amenities',
    icon: <CIcon icon={cilBuilding} customClassName="nav-icon" />,
    requiredPermission: [
      'amenities:dashboard',
      'amenities:amenities',
      'amenities:admin_calander',
      'amenities:ledgers',
      'amenities:maintenance',
      'amenities:settings',
      'amenities:scanner',
      'amenities:security_logs',
      'amenities:discover',
      'amenities:my_booking',
      'amenities:wallet',
    ],
  },
  {
    component: CNavItem,
    name: 'Notice Board',
    to: '/notices',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
    requiredPermission: [
      'notices:dashboard',
      'notices:active_board',
      'notices:manage_notices',
      'notices:polls',
    ],
  },
  {
    component: CNavItem,
    name: 'Complaints / Maintenance',
    to: '/complaints',
    icon: <CIcon icon={cilWarning} customClassName="nav-icon" />,
    requiredPermission: [
      'complaints:dashboard',
      'complaints:raise_ticket',
      'complaints:track_requests',
      'complaints:complaint_management',
      'complaints:staff',
      'complaints:assignee',
    ],
  },
  {
    component: CNavItem,
    name: 'Community Manager',
    to: '/super-admin/organizations',
    icon: <CIcon icon={cilBuilding} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Audit Logs',
    to: '/super-admin/audit-logs',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Issue Reports',
    to: '/super-admin/issue-reports',
    icon: <CIcon icon={cilWarning} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Billing & Invoices',
    to: '/billing',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
    requiredPermission: [
      'billing:dashboard',
      'billing:assessment_manager',
      'billing:action_center',
    ],
  },
]

export default _nav
