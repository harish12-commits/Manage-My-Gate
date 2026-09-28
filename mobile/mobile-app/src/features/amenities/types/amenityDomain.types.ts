/**
 * Amenity Management v2 - Domain Types
 * Clean domain models for mobile state, presentation, and booking flow coordination.
 */

import {
  AmenityArchetype,
  AmenityPricingType,
  AmenityFacilityStatus,
  AmenityAssetState,
  AmenityHoldType,
  AmenityHoldStatus,
  AmenityBookingStatus,
  AmenityPaymentStatus,
  AmenityApprovalStatus,
  AmenityAccessStatus,
  AmenityCompletionStatus,
  AmenityPassType,
  AmenityPassStatus,
  AmenityMaintenanceStatus,
  AmenityInspectionDetails,
  ApiPaginationMeta,
} from './amenityApi.types';

export {
  AmenityArchetype,
  AmenityPricingType,
  AmenityFacilityStatus,
  AmenityAssetState,
  AmenityHoldType,
  AmenityHoldStatus,
  AmenityBookingStatus,
  AmenityPaymentStatus,
  AmenityApprovalStatus,
  AmenityAccessStatus,
  AmenityCompletionStatus,
  AmenityPassType,
  AmenityPassStatus,
  AmenityMaintenanceStatus,
  AmenityInspectionDetails,
};

// Facility Domain Model
export interface AmenityFacilityOperatingHour {
  dayOfWeek: number;
  opensAt?: string;
  closesAt?: string;
  openTime?: string;
  closeTime?: string;
  isOpen: boolean;
}

export interface AmenityFacilityPricingConfig {
  type: AmenityPricingType;
  baseRate: number;
  depositAmount: number;
  taxRate: number;
  currency: string;
}

export interface AmenityFacilityBookingRules {
  minNoticeHours: number;
  maxAdvanceBookingDays: number;
  cancelNoticeHours: number;
  requiresApproval: boolean;
  maxActiveReservationsPerResident: number;
}

export interface AmenityFacility {
  _id: string;
  orgId: string;
  code?: string;
  name: string;
  description?: string;
  location?: string;
  archetype: AmenityArchetype;
  category?: string;
  type?: string;
  status: AmenityFacilityStatus;
  isDraft?: boolean;
  isActive?: boolean;
  maxCapacity: number;
  maxHeadcountPerReservation: number;
  slotDurationMinutes: number;
  setupBufferMinutes: number;
  teardownBufferMinutes: number;
  timezone: string;
  pricingConfig: AmenityFacilityPricingConfig;
  bookingRules: AmenityFacilityBookingRules;
  operatingHours: AmenityFacilityOperatingHour[];
  images?: string[];
  createdAt: string;
  updatedAt: string;

  // Archetype profile (server-enforced booking rules)
  advanceBookingDays?: number;
  minNoticeHours?: number;
  /** EVENT_SPACE: how the venue is booked */
  bookingMode?: 'FULL_DAY' | 'SESSION' | 'HOURLY';
  sessions?: Array<{ name: string; startTime: string; endTime: string; price?: number | null }>;
  /** ROOM_RESOURCE: hourly rooms or overnight stays */
  stayMode?: 'HOURLY' | 'OVERNIGHT';
  checkInTime?: string;
  checkOutTime?: string;
  maxNights?: number;
  /** INVENTORY_TOOLS: longest loan and whether returns are inspected */
  maxLoanHours?: number;
  requiresInspection?: boolean;
  paymentPolicy?: { mode: AmenityPaymentMode; advanceType?: 'FIXED' | 'PERCENT'; advanceValue?: number };
  cancellationPolicy?: { isAllowed?: boolean; refundCutoffHours?: number; refundPercentage?: number };
}

/** How the price is collected: all when booking, an advance + balance, or at the gate. */
export type AmenityPaymentMode = 'FULL' | 'ADVANCE' | 'PAY_AT_GATE';

/** Amounts fixed by the server when a slot is held (residents never enter amounts). */
export interface AmenityAmountSchedule {
  mode: AmenityPaymentMode;
  priceAmount: number;
  depositAmount: number;
  advanceAmount: number;
  dueNowAmount: number;
  balanceAmount: number;
}

// Resource Domain Model
export interface AmenityResource {
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
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Discrete UI Slot Selection
export interface AmenitySlotSelection {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  facilityTimezone?: string; // IANA timezone, e.g. "Asia/Riyadh" or "Asia/Kolkata"
  utcStartDateTime: string; // ISO string
  utcEndDateTime: string; // ISO string
  slotId?: string;
}

// Dynamic Guest Row with client-side identifier (stripped before API submission)
export interface AmenityGuest {
  clientId?: string; // In-memory unique ID for UI list keys
  name: string;
  phone?: string;
  email?: string;
}

// Dynamic Availability Evaluation Result
export interface AmenityAvailabilityResult {
  isAvailable: boolean;
  available?: boolean; // Compatibility alias
  reason?: string;
  availableUnits?: number;
  maxCapacity?: number;
  effectiveStartDateTime: string;
  effectiveEndDateTime: string;
}

// Immutable Pricing Snapshot
export interface AmenityPricingSnapshot {
  baseAmount: number;
  taxAmount: number;
  depositAmount: number;
  totalAmount: number;
  currency: string;
}

// Reservation Hold State
export interface AmenityHoldState {
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
  expiresAt: string; // Authoritative backend expiration timestamp
  pricingSnapshot?: AmenityPricingSnapshot;
  amountSchedule?: AmenityAmountSchedule;
  reservationId?: string | null;
}

// Complete Reservation Domain Model with Five Independent Status Dimensions
export interface AmenityReservation {
  _id: string;
  reservationNumber?: string;
  orgId: string;
  facilityId: string;
  facilityName?: string;
  facilityTimezone?: string;
  resourceId?: string;
  resourceName?: string;
  userId: string;
  userName?: string;
  unitId?: string;
  startDateTime: string; // UTC ISO string
  endDateTime: string; // UTC ISO string
  effectiveStartDateTime?: string;
  effectiveEndDateTime?: string;
  requestedStartDateTime?: string;
  requestedEndDateTime?: string;
  headcount: number;
  quantity: number;
  guests?: Array<{ name: string; phone?: string; email?: string }>;
  pricingSnapshot: AmenityPricingSnapshot;

  // The Five Orthogonal State Dimensions
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
  paymentMethod?: 'NONE' | 'WALLET' | 'RAZORPAY' | string;
  paidAmount?: number;
  refundAmount?: number;
  refundMethod?: 'WALLET' | 'RAZORPAY' | string;
  totalAmount?: number;
  depositAmount?: number;
  /** Price still to be paid, online before the slot or at the gate */
  balanceAmount?: number;
  amountSchedule?: AmenityAmountSchedule;
  payments?: Array<{
    purpose: 'BOOKING' | 'BALANCE';
    method: 'WALLET' | 'RAZORPAY' | 'CASH';
    amount: number;
    receiptNumber?: string | null;
    paidAt?: string;
  }>;
  refundPercentage?: number | null;
  refundBreakdown?: { bookingRefund: number; depositRefund: number; reason?: string | null };
  depositSettlement?: { refunded?: number | null; retained?: number | null; notes?: string | null; settledAt?: string | null };
  adminReview?: {
    status: 'NONE' | 'PENDING' | 'RESOLVED';
    reason?: 'NO_SHOW' | 'UNPAID_BALANCE' | 'OVERDUE_RETURN' | null;
    resolution?: string | null;
    refundAmount?: number | null;
    notes?: string | null;
  };
  policySnapshot?: { cancellation?: { isAllowed?: boolean; refundCutoffHours?: number; refundPercentage?: number } };
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  completedAt?: string | null;
  bookedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Access Pass Domain Model
export interface AmenityAccessPass {
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
  resident?: {
    id?: string;
    name?: string;
    photoUrl?: string | null;
    unitNumber?: string | null;
    villaNumber?: string | null;
    phone?: string | null;
  };
  facility?: {
    id?: string;
    name?: string;
    location?: string | null;
  };
  booking?: {
    id?: string;
    bookingId?: string;
    reservationNumber?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    headcount?: number;
  };
  organisation?: {
    id?: string;
    name?: string;
  };
  guard?: {
    id?: string;
    name?: string;
  };
}

// Maintenance Block Domain Model
export interface AmenityMaintenanceBlock {
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

// Normalized Error Model for Domain and Redux Store
export interface AmenityErrorDetails {
  message: string;
  statusCode?: number;
  code?: string;
  reason?: string;
  fieldErrors?: Record<string, string>;
  isConflict?: boolean;
  conflictType?:
    | 'SLOT_CAPACITY'
    | 'IDEMPOTENCY_MISMATCH'
    | 'OPERATION_IN_PROGRESS'
    | 'CONCURRENCY_VERSION'
    | 'GENERIC';
  isHoldExpired?: boolean;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  details?: any;
  requiresBookingAction?: boolean;
  upcomingBookingsCount?: number;
  requiresConflictAction?: boolean;
  requiresResolution?: boolean;
}
