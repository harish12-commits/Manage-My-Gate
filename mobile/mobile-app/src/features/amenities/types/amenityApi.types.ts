/**
 * Amenity Management v2 - API Types
 * Strictly mirrored from the frozen Phase 5 backend (backend/src/features/amenityManagement/).
 * ZERO phantom fields, ZERO unauthorized enums.
 */

export type AmenityArchetype =
  'SHARED_CAPACITY' | 'EXCLUSIVE_HOURLY' | 'EVENT_SPACE' | 'ROOM_RESOURCE' | 'INVENTORY_TOOLS';

export type AmenityPricingType = 'FREE' | 'HOURLY' | 'DAILY' | 'FIXED_EVENT' | 'TIERED';

export type AmenityFacilityStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export type AmenityAssetState = 'AVAILABLE' | 'CHECKED_OUT' | 'INSPECTION_PENDING' | 'MAINTENANCE';

export type AmenityHoldType = 'STANDARD' | 'ADMIN_REVIEW' | 'PAYMENT_PENDING';

export type AmenityHoldStatus = 'ACTIVE' | 'PROMOTED' | 'EXPIRED' | 'RELEASED';

// The Five Orthogonal State Dimensions (Strictly from backend/src/features/amenityManagement/reservations/amenityReservation.model.js)
export type AmenityBookingStatus = 'PENDING_APPROVAL' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';

// NOTE: 'EXEMPTED' does NOT exist in backend schemas. 'NOT_REQUIRED' is used for zero-cost / fee-waived reservations.
export type AmenityPaymentStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'HELD_AUTHORIZED'
  | 'ADVANCE_PAID'
  | 'PAID'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FAILED';

export type AmenityApprovalStatus = 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type AmenityAccessStatus =
  'NOT_APPLICABLE' | 'PASS_GENERATED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'ACCESS_REVOKED';

export type AmenityCompletionStatus = 'PENDING' | 'COMPLETED' | 'NO_SHOW' | 'ABANDONED';

export type AmenityPassType = 'QR_DYNAMIC' | 'PIN_CODE' | 'RFID_NFC';

export type AmenityPassStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';

export type AmenityMaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Standard Backend Response Envelopes
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  isReplay?: boolean;
}

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiPaginatedResponse<T = any> {
  items?: T[];
  pagination?: ApiPaginationMeta;
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

// Validation Error Structure returned by Express-Validator on HTTP 400
export interface ApiValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  details?: ApiValidationErrorDetail[] | string[];
}

// Facility Entity
export interface ApiFacilityOperatingHour {
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  opensAt: string; // "HH:mm"
  closesAt: string; // "HH:mm"
  isOpen: boolean;
}

export interface ApiFacilityPricingConfig {
  type: AmenityPricingType;
  baseRate: number;
  depositAmount: number;
  taxRate: number;
  currency: string;
}

export interface ApiFacilityBookingRules {
  minNoticeHours: number;
  maxAdvanceBookingDays: number;
  cancelNoticeHours: number;
  requiresApproval: boolean;
  maxActiveReservationsPerResident: number;
}

export interface ApiAmenityFacility {
  _id: string;
  orgId: string;
  code?: string;
  name: string;
  description?: string;
  location?: string;
  archetype: AmenityArchetype;
  status: AmenityFacilityStatus;
  isActive?: boolean;
  maxCapacity: number;
  maxHeadcountPerReservation: number;
  slotDurationMinutes: number;
  setupBufferMinutes: number;
  teardownBufferMinutes: number;
  timezone: string;
  pricingConfig: ApiFacilityPricingConfig;
  bookingRules: ApiFacilityBookingRules;
  operatingHours: ApiFacilityOperatingHour[];
  images?: string[];
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

// Resource Entity (for ROOM_RESOURCE or INVENTORY_TOOLS)
export interface ApiAmenityResource {
  _id: string;
  orgId: string;
  facilityId: string;
  name: string;
  identifier: string;
  concurrencyVersion: number;
  setupBufferMinutes: number;
  teardownBufferMinutes: number;
  isSerializedAsset: boolean;
  serialNumber?: string;
  assetState: AmenityAssetState;
  totalBulkStock: number;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

// Availability Evaluation Response
export interface ApiAvailabilityResponse {
  isAvailable: boolean;
  reason?: string;
  availableUnits?: number;
  maxCapacity?: number;
  effectiveStartDateTime: string;
  effectiveEndDateTime: string;
}

// Pricing Snapshot
export interface ApiPricingSnapshot {
  baseAmount: number;
  taxAmount: number;
  depositAmount: number;
  totalAmount: number;
  currency: string;
}

// Hold Entity
export interface ApiAmenityHold {
  _id: string;
  orgId: string;
  facilityId: string;
  resourceId?: string;
  userId: string;
  unitId?: string;
  requestedStartDateTime: string;
  requestedEndDateTime: string;
  headcount: number;
  quantity: number;
  holdType: AmenityHoldType;
  status: AmenityHoldStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCreateHoldResponse {
  hold: ApiAmenityHold;
  pricingSnapshot: ApiPricingSnapshot;
}

// Reservation Entity
export interface ApiAmenityGuest {
  name: string;
  phone?: string;
  email?: string;
}

export interface ApiAmenityReservation {
  _id: string;
  reservationNumber?: string;
  orgId: string;
  facilityId: string | ApiAmenityFacility;
  resourceId?: string | ApiAmenityResource;
  userId: string | any;
  unitId?: string;
  startDateTime: string;
  endDateTime: string;
  headcount: number;
  quantity: number;
  guests?: ApiAmenityGuest[];
  pricingSnapshot: ApiPricingSnapshot;
  bookingStatus: AmenityBookingStatus;
  paymentStatus: AmenityPaymentStatus;
  approvalStatus: AmenityApprovalStatus;
  accessStatus: AmenityAccessStatus;
  completionStatus: AmenityCompletionStatus;
  rejectionReason?: string;
  cancellationReason?: string;
  notes?: string;
  holdId?: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

export interface AmenityInspectionDetails {
  isDamaged?: boolean;
  damageNotes?: string;
  assessedPenaltyAmount?: number;
  checkedOutByStaff?: string;
  returnInspectedByStaff?: string;
}

// Access Pass Entity
export interface ApiAmenityAccessPass {
  _id: string;
  orgId: string;
  facilityId?: string;
  facilityName?: string;
  reservationId: string;
  userId?: string;
  passCode?: string;
  qrData?: string;
  passType: AmenityPassType | string;
  validFrom: string;
  validUntil: string;
  maxUses?: number;
  currentUses?: number;
  checkedInAt?: string;
  checkedOutAt?: string;
  status?: AmenityPassStatus;
  checkInTimestamp?: string | null;
  checkOutTimestamp?: string | null;
  gateId?: string | null;
  isRevoked?: boolean;
  revokedAt?: string | null;
  revokedReason?: string | null;
  inspectionDetails?: AmenityInspectionDetails | null;
  passTokenHash?: string;
  createdAt: string;
  updatedAt: string;
}

// Maintenance Block Entity
export interface ApiAmenityMaintenanceBlock {
  _id: string;
  orgId: string;
  facilityId: string;
  resourceId?: string;
  startDateTime: string;
  endDateTime: string;
  reason: string;
  blockType: string;
  status: AmenityMaintenanceStatus;
  createdAt: string;
  updatedAt: string;
}

// Request Payloads
export interface CreateHoldApiPayload {
  facilityId: string;
  resourceId?: string;
  requestedStartDateTime: string;
  requestedEndDateTime: string;
  headcount?: number;
  quantity?: number;
  holdType?: AmenityHoldType;
  holdDurationMinutes?: number;
  unitId?: string;
  quotaLimit?: number;
}

export interface ConfirmReservationApiPayload {
  holdId: string;
  paymentMethod?: 'WALLET' | 'RAZORPAY';
  // Backend Payment record ID. Razorpay identifiers alone are never accepted
  // as proof of payment for a reservation.
  paymentId?: string;
  /** @deprecated Kept only so older callers compile. The backend never uses this as payment proof. */
  paymentReference?: string;
  notes?: string;
}

export interface ApiAmenityPaymentOrder {
  paymentId: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  razorpayKeyId?: string;
  alreadyVerified?: boolean;
}

export interface CalculatePricingApiPayload {
  facilityId: string;
  startDateTime: string;
  endDateTime: string;
  headcount?: number;
  quantity?: number;
}

export interface CancelReservationApiPayload {
  reason?: string;
}

export interface ReviewReservationApiPayload {
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
}

export interface ScheduleMaintenanceApiPayload {
  facilityId: string;
  resourceId?: string | null;
  resourceIds?: string[];
  title: string;
  reason: string;
  maintenanceType?: 'CLEANING' | 'REPAIR' | 'INSPECTION' | 'UPGRADE' | 'PREVENTIVE' | 'OTHER';
  internalNotes?: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  startDateTime?: string;
  endDateTime?: string;
  windows?: Array<{
    startDateTime: string;
    endDateTime: string;
  }>;
  isCompleteClosure?: boolean;
  degradedCapacity?: number;
  conflictAction?: 'CANCEL_AND_PROCEED';
  resolutions?: Array<{
    targetId: string;
    resolution: 'CANCEL' | 'RESCHEDULE' | 'REVIEW_INDIVIDUALLY';
  }>;
}

export interface MaintenanceRecurrenceConfig {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startDate?: string;
  endDate?: string;
  occurrenceCount?: number;
  timezone?: string;
}

export interface PreviewRecurringMaintenanceApiPayload {
  facilityId: string;
  resourceId?: string | null;
  resourceIds?: string[];
  title: string;
  description?: string;
  reason: string;
  maintenanceType?: string;
  startDateTime: string;
  endDateTime: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  recurrence: MaintenanceRecurrenceConfig;
}

export interface ScheduleRecurringMaintenanceApiPayload extends PreviewRecurringMaintenanceApiPayload {
  internalNotes?: string;
  isCompleteClosure?: boolean;
  degradedCapacity?: number;
  conflictAction?: 'CANCEL_AND_PROCEED';
  impactResolutions?: Array<{
    targetId: string;
    resolution: 'CANCEL' | 'RESCHEDULE' | 'REVIEW_INDIVIDUALLY';
  }>;
  resolutions?: Array<{
    targetId: string;
    resolution: 'CANCEL' | 'RESCHEDULE' | 'REVIEW_INDIVIDUALLY';
  }>;
}

export interface DeclareEmergencyMaintenanceApiPayload {
  facilityId: string;
  resourceId?: string | null;
  resourceIds?: string[];
  title: string;
  reason: string;
  maintenanceType?: string;
  internalNotes?: string;
  endDateTime: string;
  bufferAfterMinutes?: number;
  conflictAction?: 'CANCEL_AND_PROCEED' | 'REVIEW_ALL';
  resolutions?: Array<{
    targetId: string;
    resolution: 'CANCEL' | 'RESCHEDULE' | 'REVIEW_INDIVIDUALLY';
  }>;
}

export interface MaintenanceImpactPreviewApiPayload {
  facilityId: string;
  resourceId?: string | null;
  resourceIds?: string[];
  startDateTime?: string;
  endDateTime?: string;
  windows?: Array<{
    startDateTime: string;
    endDateTime: string;
  }>;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}

export interface FindAlternativesApiPayload {
  facilityId: string;
  resourceId?: string | null;
  originalStart: string;
  originalEnd: string;
  searchDaysAhead?: number;
}

export interface ResolveMaintenanceImpactApiPayload {
  resolutions: Array<{
    targetId: string;
    targetType?: 'V1_BOOKING' | 'V2_RESERVATION';
    resolution: 'CANCEL' | 'RESCHEDULE' | 'REVIEW_INDIVIDUALLY';
  }>;
}

export interface ExtendMaintenanceBlockApiPayload {
  newEndDateTime: string;
  blockType?: string;
  isCompleteClosure?: boolean;
  degradedCapacity?: number;
  conflictAction?: 'CANCEL_AND_PROCEED';
  resolutions?: Array<{
    targetId: string;
    resolution: 'CANCEL' | 'RESCHEDULE' | 'REVIEW_INDIVIDUALLY';
  }>;
}

export interface CheckInPassApiPayload {
  rawToken?: string;
  passCode?: string;
  gateId?: string;
  turnstileId?: string;
}

export interface CheckOutPassApiPayload {
  rawToken?: string;
  passCode?: string;
  inspectionDetails?: AmenityInspectionDetails;
}

export interface RevokePassApiPayload {
  reason: string;
}
