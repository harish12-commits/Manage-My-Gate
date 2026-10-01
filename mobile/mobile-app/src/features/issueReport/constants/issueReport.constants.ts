import { DropdownOption } from '@/components/forms/DropdownSelect';

export type ReportType = 'BUG' | 'FEATURE_REQUEST' | 'OTHER';

export type FeatureModule =
  | 'AMENITIES_BOOKING'
  | 'COMPLAINTS_MAINTENANCE'
  | 'VISITORS_GATE_ACCESS'
  | 'PAYMENTS'
  | 'COMMUNITY_DIRECTORY'
  | 'NOTIFICATIONS'
  | 'PROFILE_ACCOUNT'
  | 'AUTHENTICATION'
  | 'OTHER';

export interface ReportTypeOption {
  label: string;
  value: ReportType;
  description: string;
  iconName: 'Bug' | 'Sparkles' | 'HelpCircle';
}

export const REPORT_TYPE_OPTIONS: ReportTypeOption[] = [
  {
    label: 'Get Help',
    value: 'BUG',
    description: 'Something is broken or not working as expected',
    iconName: 'Bug',
  },
  {
    label: 'Feature Request',
    value: 'FEATURE_REQUEST',
    description: 'Suggest a new capability or improvement',
    iconName: 'Sparkles',
  },
  {
    label: 'Other',
    value: 'OTHER',
    description: 'General inquiry or feedback',
    iconName: 'HelpCircle',
  },
];

export const REPORT_TYPES: Record<ReportType, { label: string; color: 'danger' | 'info' | 'neutral' }> = {
  BUG: { label: 'Get Help', color: 'danger' },
  FEATURE_REQUEST: { label: 'Feature Request', color: 'info' },
  OTHER: { label: 'Other', color: 'neutral' },
};

export const FEATURE_MODULE_OPTIONS: DropdownOption[] = [
  { label: 'Amenities & Booking', value: 'AMENITIES_BOOKING' },
  { label: 'Complaints & Maintenance', value: 'COMPLAINTS_MAINTENANCE' },
  { label: 'Visitors / Gate Access', value: 'VISITORS_GATE_ACCESS' },
  { label: 'Payments', value: 'PAYMENTS' },
  { label: 'Community Directory', value: 'COMMUNITY_DIRECTORY' },
  { label: 'Notifications', value: 'NOTIFICATIONS' },
  { label: 'Profile / Account', value: 'PROFILE_ACCOUNT' },
  { label: 'Authentication', value: 'AUTHENTICATION' },
  { label: 'Other', value: 'OTHER' },
];

export const FEATURE_MODULES: Record<FeatureModule, string> = {
  AMENITIES_BOOKING: 'Amenities & Booking',
  COMPLAINTS_MAINTENANCE: 'Complaints & Maintenance',
  VISITORS_GATE_ACCESS: 'Visitors / Gate Access',
  PAYMENTS: 'Payments',
  COMMUNITY_DIRECTORY: 'Community Directory',
  NOTIFICATIONS: 'Notifications',
  PROFILE_ACCOUNT: 'Profile / Account',
  AUTHENTICATION: 'Authentication',
  OTHER: 'Other',
};

export const ISSUE_REPORT_CONSTRAINTS = {
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 3000,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ALLOWED_IMAGE_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
  ALLOWED_IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
