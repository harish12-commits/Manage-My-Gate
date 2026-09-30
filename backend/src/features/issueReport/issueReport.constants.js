/**
 * Issue Report Domain Constants & Enums
 * Centralized enumeration of supported report types, target feature modules, and client platforms.
 */

export const REPORT_TYPES = Object.freeze({
  BUG: 'BUG',
  FEATURE_REQUEST: 'FEATURE_REQUEST',
  OTHER: 'OTHER',
});

export const REPORT_MODULES = Object.freeze({
  AMENITIES_BOOKING: 'AMENITIES_BOOKING',
  COMPLAINTS_MAINTENANCE: 'COMPLAINTS_MAINTENANCE',
  VISITORS_GATE_ACCESS: 'VISITORS_GATE_ACCESS',
  PAYMENTS: 'PAYMENTS',
  COMMUNITY_DIRECTORY: 'COMMUNITY_DIRECTORY',
  NOTIFICATIONS: 'NOTIFICATIONS',
  PROFILE_ACCOUNT: 'PROFILE_ACCOUNT',
  AUTHENTICATION: 'AUTHENTICATION',
  OTHER: 'OTHER',
});

export const SUPPORTED_PLATFORMS = Object.freeze(['android', 'ios', 'web']);

export const REPORT_SOURCES = Object.freeze(['MOBILE_APP', 'WEB_PORTAL', 'EXTERNAL']);

// Fields clients may sort report listings by.
export const SORTABLE_FIELDS = Object.freeze(['createdAt', 'reportNumber', 'reportType', 'feature', 'title']);
