/**
 * Issue Report Feature Constants
 * Central source of truth for report types, feature modules, and sources.
 */

export const REPORT_TYPES = {
  BUG: {
    label: 'Get Help',
    color: 'danger',
  },
  FEATURE_REQUEST: {
    label: 'Feature Request',
    color: 'info',
  },
  OTHER: {
    label: 'Other',
    color: 'secondary',
  },
}

export const REPORT_TYPE_OPTIONS = [
  { value: '', label: 'All Report Types' },
  { value: 'BUG', label: 'Get Help' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'OTHER', label: 'Other' },
]

export const FEATURE_MODULES = {
  AMENITIES_BOOKING: 'Amenities & Booking',
  COMPLAINTS_MAINTENANCE: 'Complaints & Maintenance',
  VISITORS_GATE_ACCESS: 'Visitors / Gate Access',
  PAYMENTS: 'Payments',
  COMMUNITY_DIRECTORY: 'Community Directory',
  NOTIFICATIONS: 'Notifications',
  PROFILE_ACCOUNT: 'Profile / Account',
  AUTHENTICATION: 'Authentication',
  OTHER: 'Other',
}

export const FEATURE_MODULE_OPTIONS = [
  { value: '', label: 'All Features / Modules' },
  { value: 'AMENITIES_BOOKING', label: 'Amenities & Booking' },
  { value: 'COMPLAINTS_MAINTENANCE', label: 'Complaints & Maintenance' },
  { value: 'VISITORS_GATE_ACCESS', label: 'Visitors / Gate Access' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'COMMUNITY_DIRECTORY', label: 'Community Directory' },
  { value: 'NOTIFICATIONS', label: 'Notifications' },
  { value: 'PROFILE_ACCOUNT', label: 'Profile / Account' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
  { value: 'OTHER', label: 'Other' },
]

export const SOURCES = {
  MOBILE_APP: 'Mobile App',
  WEB_PORTAL: 'Web Portal',
  EXTERNAL: 'External',
}

export const DEFAULT_PAGE_LIMIT = 20
export const PAGE_LIMIT_OPTIONS = [10, 20, 50, 100]
