/**
 * Amenity Management v2 - Payload & Response Mappers
 * Bridges UI form inputs to backend API schemas, and normalizes server responses into clean domain models.
 * Replicates the proven Visitor Management pattern (e.g. client-only ID stripping) without importing Visitor code.
 */

import {
  ApiAmenityFacility,
  ApiAmenityResource,
  ApiAmenityHold,
  ApiAmenityReservation,
  ApiAmenityAccessPass,
  ApiAvailabilityResponse,
  ApiPricingSnapshot,
  ApiAmenityGuest,
  CreateHoldApiPayload,
  ConfirmReservationApiPayload,
  CalculatePricingApiPayload,
} from '../types/amenityApi.types';

import {
  AmenityFacility,
  AmenityFacilityStatus,
  AmenityPricingType,
  AmenityResource,
  AmenityHoldState,
  AmenityReservation,
  AmenityAccessPass,
  AmenityAvailabilityResult,
  AmenityPricingSnapshot,
  AmenityGuest,
  AmenitySlotSelection,
} from '../types/amenityDomain.types';

/**
 * Maps dynamic guest rows from UI to backend API format.
 * Strips client-only `clientId` identifiers used for in-memory list rendering.
 */
export const mapGuestsToApiPayload = (guests?: AmenityGuest[]): ApiAmenityGuest[] => {
  if (!guests || !Array.isArray(guests)) return [];

  return guests
    .filter((g) => g && g.name && g.name.trim().length > 0)
    .map((g) => ({
      name: g.name.trim(),
      phone: g.phone && g.phone.trim().length > 0 ? g.phone.trim() : undefined,
      email: g.email && g.email.trim().length > 0 ? g.email.trim() : undefined,
    }));
};

/**
 * Builds the payload for POST /holds from wizard inputs.
 */
export const mapHoldFormToApiPayload = (params: {
  facilityId: string;
  resourceId?: string;
  slotSelection: AmenitySlotSelection;
  headcount?: number;
  quantity?: number;
  holdType?: 'STANDARD' | 'ADMIN_REVIEW' | 'PAYMENT_PENDING';
  holdDurationMinutes?: number;
  unitId?: string;
  quotaLimit?: number;
}): CreateHoldApiPayload => {
  return {
    facilityId: params.facilityId,
    resourceId: params.resourceId || undefined,
    requestedStartDateTime: params.slotSelection.utcStartDateTime,
    requestedEndDateTime: params.slotSelection.utcEndDateTime,
    headcount: params.headcount && params.headcount > 0 ? params.headcount : 1,
    quantity: params.quantity && params.quantity > 0 ? params.quantity : 1,
    holdType: params.holdType || 'STANDARD',
    holdDurationMinutes: params.holdDurationMinutes,
    unitId: params.unitId || undefined,
    quotaLimit: params.quotaLimit,
  };
};

/**
 * Builds the payload for POST /reservations/confirm.
 */
export const mapConfirmFormToApiPayload = (params: {
  holdId: string;
  paymentMethod?: 'WALLET' | 'RAZORPAY';
  paymentId?: string;
  /** @deprecated A client payment reference is intentionally not sent to the API. */
  paymentReference?: string;
  notes?: string;
}): ConfirmReservationApiPayload => {
  return {
    holdId: params.holdId.trim(),
    paymentMethod: params.paymentMethod,
    paymentId: params.paymentId?.trim() || undefined,
    // Retained for backwards-compatible UI/read-model callers. The backend
    // ignores it for settlement and derives the stored reference itself.
    paymentReference: params.paymentReference?.trim() || undefined,
    notes: params.notes?.trim() || undefined,
  };
};

/**
 * Builds the payload for POST /pricing/calculate.
 */
export const mapPricingFormToApiPayload = (params: {
  facilityId: string;
  startDateTime: string;
  endDateTime: string;
  headcount?: number;
  quantity?: number;
}): CalculatePricingApiPayload => {
  return {
    facilityId: params.facilityId,
    startDateTime: params.startDateTime,
    endDateTime: params.endDateTime,
    headcount: params.headcount || 1,
    quantity: params.quantity || 1,
  };
};

// ==========================================
// API -> Domain Response Normalizers
// ==========================================

export const normalizeFacilityFromApi = (raw: ApiAmenityFacility | any): AmenityFacility => {
  const rawStatusUpper = typeof raw.status === 'string' ? raw.status.toUpperCase() : '';
  const isDraft = Boolean(raw.isDraft === true || raw.isDraft === 'true' || rawStatusUpper === 'DRAFT');
  const derivedStatus: AmenityFacilityStatus = isDraft
    ? 'DRAFT'
    : (rawStatusUpper as AmenityFacilityStatus) || (raw.isActive === false ? 'INACTIVE' : 'ACTIVE');

  const rawPricing = raw.pricingConfig || {};
  const pricingType = (rawPricing.type || rawPricing.pricingType || (raw.bookingFee ? 'HOURLY' : 'FREE')) as AmenityPricingType;
  const baseRate = Number(rawPricing.baseRate ?? raw.bookingFee ?? 0);
  const depositAmount = Number(rawPricing.depositAmount ?? rawPricing.securityDeposit ?? raw.securityDeposit ?? 0);
  const taxRate = Number(rawPricing.taxRate ?? rawPricing.taxPercentage ?? 0);
  const currency = rawPricing.currency || 'INR';

  const rawBookingRules = raw.bookingRules || {};
  const requiresApproval = Boolean(raw.requiresApproval ?? rawBookingRules.requiresApproval ?? false);

  const operatingHours = Array.isArray(raw.operatingHours)
    ? raw.operatingHours.map((h: any) => ({
        dayOfWeek: h.dayOfWeek,
        opensAt: h.opensAt || h.openTime || '06:00',
        closesAt: h.closesAt || h.closeTime || '22:00',
        openTime: h.openTime || h.opensAt || '06:00',
        closeTime: h.closeTime || h.closesAt || '22:00',
        isOpen: h.isOpen !== undefined ? h.isOpen : true,
      }))
    : [];

  return {
    _id: raw._id || raw.id,
    orgId: raw.orgId || raw.organizationId,
    code: raw.code,
    name: raw.name,
    description: raw.description,
    location: raw.location,
    archetype: raw.archetype,
    category: raw.category || raw.type || undefined,
    type: raw.type || raw.category || undefined,
    status: derivedStatus,
    isDraft,
    isActive: isDraft ? false : (raw.isActive !== undefined ? raw.isActive : derivedStatus === 'ACTIVE'),
    maxCapacity: raw.maxCapacity ?? raw.capacity ?? 1,
    maxHeadcountPerReservation: raw.maxHeadcountPerReservation ?? raw.maxBookingsPerUserPerSlot ?? 1,
    slotDurationMinutes: raw.slotDurationMinutes ?? rawBookingRules.slotDurationMinutes ?? 60,
    setupBufferMinutes: raw.setupBufferMinutes ?? rawBookingRules.bufferTimeMinutes ?? 0,
    teardownBufferMinutes: raw.teardownBufferMinutes ?? 0,
    timezone: raw.timezone || 'UTC',
    pricingConfig: {
      type: pricingType,
      baseRate,
      depositAmount,
      taxRate,
      currency,
      ...(rawPricing as any),
    },
    bookingRules: {
      minNoticeHours: rawBookingRules.minNoticeHours ?? 0,
      maxAdvanceBookingDays: rawBookingRules.maxAdvanceBookingDays ?? 30,
      cancelNoticeHours: rawBookingRules.cancelNoticeHours ?? raw.cancellationPolicy?.refundCutoffHours ?? 24,
      requiresApproval,
      maxActiveReservationsPerResident: rawBookingRules.maxActiveReservationsPerResident ?? 3,
      ...rawBookingRules,
    },
    operatingHours,
    images: Array.isArray(raw.images) ? [...raw.images] : (raw.imageUrl ? [raw.imageUrl] : []),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    advanceBookingDays: raw.advanceBookingDays ?? rawBookingRules.advanceBookingDays,
    minNoticeHours: raw.minNoticeHours ?? rawBookingRules.minNoticeHours,
    bookingMode: raw.bookingMode,
    sessions: Array.isArray(raw.sessions) ? raw.sessions.map((s: any) => ({ ...s })) : [],
    stayMode: raw.stayMode,
    checkInTime: raw.checkInTime,
    checkOutTime: raw.checkOutTime,
    maxNights: raw.maxNights,
    maxLoanHours: raw.maxLoanHours,
    requiresInspection: raw.requiresInspection,
    paymentPolicy: raw.paymentPolicy ? { ...raw.paymentPolicy } : { mode: 'FULL' },
    cancellationPolicy: raw.cancellationPolicy ? { ...raw.cancellationPolicy } : undefined,
  };
};

/** Normalizes the server's amount schedule (amounts due now / later). */
export const normalizeAmountSchedule = (raw: any) =>
  raw
    ? {
        mode: raw.mode || 'FULL',
        priceAmount: Number(raw.priceAmount || 0),
        depositAmount: Number(raw.depositAmount || 0),
        advanceAmount: Number(raw.advanceAmount || 0),
        dueNowAmount: Number(raw.dueNowAmount || 0),
        balanceAmount: Number(raw.balanceAmount || 0),
      }
    : undefined;

export const normalizeResourceFromApi = (raw: ApiAmenityResource | any): AmenityResource => {
  return {
    _id: raw._id || raw.id,
    orgId: raw.orgId || raw.organizationId,
    facilityId: raw.facilityId || raw.facility_id,
    name: raw.name,
    identifier: raw.identifier || raw.code,
    concurrencyVersion: raw.concurrencyVersion ?? 0,
    setupBufferMinutes: raw.setupBufferMinutes ?? 0,
    teardownBufferMinutes: raw.teardownBufferMinutes ?? 0,
    isSerializedAsset: Boolean(raw.isSerializedAsset),
    serialNumber: raw.serialNumber,
    assetState: raw.assetState || 'AVAILABLE',
    totalBulkStock: raw.totalBulkStock ?? 1,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const normalizePricingSnapshot = (raw?: ApiPricingSnapshot): AmenityPricingSnapshot => {
  const base = Number(raw?.baseAmount) || 0;
  const tax = Number(raw?.taxAmount) || 0;
  const deposit = Number(raw?.depositAmount) || 0;
  const computedTotal = Math.round((base + tax + deposit) * 100) / 100;
  const rawTotal = raw?.totalAmount !== undefined && raw?.totalAmount !== null ? Number(raw.totalAmount) : computedTotal;
  // If backend total did not include depositAmount, guarantee deposit is added
  const effectiveTotal = deposit > 0 && Math.abs(rawTotal - (base + tax)) < 0.01 ? computedTotal : rawTotal;

  return {
    baseAmount: base,
    taxAmount: tax,
    depositAmount: deposit,
    totalAmount: effectiveTotal,
    currency: raw?.currency || 'INR',
  };
};

export const normalizeHoldFromApi = (
  payload: any,
  pricingSnapshot?: ApiPricingSnapshot
): AmenityHoldState => {
  const raw = payload?.hold ? payload.hold : payload;
  const snapshotToUse = pricingSnapshot || raw?.pricingSnapshot || payload?.pricingSnapshot;
  return {
    _id: raw._id,
    orgId: raw.orgId,
    facilityId: raw.facilityId,
    resourceId: raw.resourceId,
    userId: raw.userId,
    unitId: raw.unitId,
    requestedStartDateTime: raw.requestedStartDateTime,
    requestedEndDateTime: raw.requestedEndDateTime,
    headcount: raw.headcount,
    quantity: raw.quantity,
    holdType: raw.holdType,
    status: raw.status,
    expiresAt: raw.expiresAt,
    pricingSnapshot: snapshotToUse ? normalizePricingSnapshot(snapshotToUse) : undefined,
    amountSchedule: normalizeAmountSchedule(raw.amountSchedule),
    reservationId: raw.reservationId ? String(raw.reservationId) : null,
  };
};

export const normalizeReservationFromApi = (payload: any): AmenityReservation => {
  if (!payload) return payload as any;

  // Accommodate payloads wrapped in { reservation, pass, rawToken } or { data: { reservation: ... } }
  const doc = (payload && typeof payload === 'object' && 'reservation' in payload && payload.reservation)
    ? payload.reservation
    : (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object' && 'reservation' in payload.data && payload.data.reservation)
      ? payload.data.reservation
      : (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object' && ('_id' in payload.data || 'bookingStatus' in payload.data || 'status' in payload.data))
        ? payload.data
        : payload;

  const facilityObj =
    typeof doc.facilityId === 'object' && doc.facilityId !== null ? doc.facilityId : null;
  const facilityId = facilityObj ? facilityObj._id : String(doc.facilityId || '');
  const facilityName = facilityObj ? facilityObj.name : doc.facilityName;
  const facilityTimezone = facilityObj ? facilityObj.timezone : doc.facilityTimezone;

  const resourceObj =
    typeof doc.resourceId === 'object' && doc.resourceId !== null ? doc.resourceId : null;
  const resourceId = resourceObj
    ? resourceObj._id
    : doc.resourceId
      ? String(doc.resourceId)
      : undefined;
  const resourceName = resourceObj ? resourceObj.name : doc.resourceName;

  const rawUser = doc.residentId || doc.userId;
  const userObj = typeof rawUser === 'object' && rawUser !== null ? rawUser : null;
  const userId = userObj ? userObj._id || userObj.id : String(rawUser || '');
  const userName = userObj
    ? userObj.fullName || userObj.name || [userObj.firstName, userObj.lastName].filter(Boolean).join(' ') || userObj.username
    : doc.userName || doc.residentName;
  const rawUnit = doc.unitId || userObj?.villaId;
  const unitId = typeof rawUnit === 'object' && rawUnit !== null
    ? rawUnit.villaNumber || rawUnit.unitNumber || rawUnit.flatNumber || rawUnit._id
    : rawUnit;
  const pricingSource = doc.pricingSnapshot || doc.pricingDetails || {
    baseAmount: doc.baseAmount ?? doc.totalAmount ?? doc.totalPrice,
    totalAmount: doc.totalAmount ?? doc.totalPrice ?? doc.paidAmount,
    taxAmount: doc.taxAmount,
    depositAmount: doc.depositAmount,
    currency: doc.currency,
  };

  const startDt = doc.startDateTime || doc.requestedStartDateTime || doc.effectiveStartDateTime || '';
  const endDt = doc.endDateTime || doc.requestedEndDateTime || doc.effectiveEndDateTime || '';

  // Fallbacks for the 5 orthogonal state dimensions
  const derivedBookingStatus = doc.bookingStatus || (
    doc.status === 'CONFIRMED' || doc.status === 'APPROVED' ? 'CONFIRMED' :
    doc.status === 'PENDING' || doc.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' :
    doc.status === 'CANCELLED' || doc.status === 'REJECTED' ? 'REJECTED' : 'CONFIRMED'
  );
  const derivedPaymentStatus = doc.paymentStatus || 'NOT_REQUIRED';
  const derivedApprovalStatus = doc.approvalStatus || 'NOT_REQUIRED';
  const derivedAccessStatus = doc.accessStatus || (derivedBookingStatus === 'CONFIRMED' ? 'PASS_GENERATED' : 'NOT_APPLICABLE');
  const derivedCompletionStatus = doc.completionStatus || 'PENDING';

  return {
    _id: String(doc._id || doc.id || ''),
    reservationNumber: doc.reservationNumber,
    orgId: doc.orgId,
    facilityId,
    facilityName,
    facilityTimezone,
    resourceId,
    resourceName,
    userId,
    userName,
    unitId,
    startDateTime: startDt,
    endDateTime: endDt,
    effectiveStartDateTime: doc.effectiveStartDateTime,
    effectiveEndDateTime: doc.effectiveEndDateTime,
    requestedStartDateTime: doc.requestedStartDateTime,
    requestedEndDateTime: doc.requestedEndDateTime,
    headcount: doc.headcount ?? 1,
    quantity: doc.quantity ?? 1,
    guests: Array.isArray(doc.guests) ? [...doc.guests] : [],
    pricingSnapshot: normalizePricingSnapshot(pricingSource),

    // The Five Independent State Dimensions
    bookingStatus: derivedBookingStatus,
    paymentStatus: derivedPaymentStatus,
    approvalStatus: derivedApprovalStatus,
    accessStatus: derivedAccessStatus,
    completionStatus: derivedCompletionStatus,

    rejectionReason: doc.rejectionReason,
    cancellationReason: doc.cancellationReason,
    notes: doc.notes,
    holdId: doc.holdId,
    paymentReference: doc.paymentReference,
    paymentMethod: doc.paymentMethod,
    // What was actually paid (never assume the full price was paid).
    paidAmount: Number(doc.paidAmount ?? 0),
    refundAmount: Number(doc.refundAmount || 0),
    refundMethod: doc.refundMethod,
    totalAmount: Number(doc.totalAmount ?? pricingSource?.totalAmount ?? 0),
    depositAmount: Number(doc.depositAmount ?? pricingSource?.depositAmount ?? 0),
    balanceAmount: Number(doc.balanceAmount ?? 0),
    amountSchedule: normalizeAmountSchedule(doc.amountSchedule),
    payments: Array.isArray(doc.payments)
      ? doc.payments.map((p: any) => ({
          purpose: p.purpose,
          method: p.method,
          amount: Number(p.amount || 0),
          receiptNumber: p.receiptNumber || null,
          paidAt: p.paidAt,
        }))
      : [],
    refundPercentage: doc.refundPercentage ?? null,
    refundBreakdown: doc.refundBreakdown || undefined,
    depositSettlement: doc.depositSettlement || undefined,
    adminReview: doc.adminReview || { status: 'NONE' },
    policySnapshot: doc.policySnapshot || undefined,
    checkedInAt: doc.checkedInAt || null,
    checkedOutAt: doc.checkedOutAt || null,
    completedAt: doc.completedAt || null,
    bookedBy: doc.bookedBy ? String(doc.bookedBy?._id || doc.bookedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

export const normalizeAccessPassFromApi = (raw: ApiAmenityAccessPass | any): AmenityAccessPass => {
  if (!raw) return raw as any;

  const passDoc = raw.pass || raw;
  const checkInTimestamp = passDoc.checkInTimestamp || passDoc.checkedInAt || null;
  const checkOutTimestamp = passDoc.checkOutTimestamp || passDoc.checkedOutAt || null;
  const qrData = String(passDoc.qrData || passDoc.rawToken || passDoc.passCode || passDoc._id || '');

  const resident = raw.resident || null;
  const facility = raw.facility || null;
  const booking = raw.booking || null;
  const organisation = raw.organisation || null;
  const guard = raw.guard || null;

  return {
    _id: String(passDoc._id || passDoc.id || ''),
    orgId: String(passDoc.orgId || raw.organisation?.id || ''),
    facilityId: String(passDoc.facilityId || facility?.id || ''),
    facilityName: facility?.name || passDoc.facilityName || 'Amenity Facility',
    reservationId: String(passDoc.reservationId || booking?.id || booking?.reservationNumber || ''),
    userId: String(passDoc.userId || resident?.id || ''),
    passCode: passDoc.passCode || booking?.bookingId || booking?.reservationNumber || (passDoc._id ? String(passDoc._id).slice(-6).toUpperCase() : 'PASS-001'),
    qrData,
    passType: passDoc.passType || 'QR_DYNAMIC',
    validFrom: passDoc.validFrom || (booking ? `${booking.date}T${booking.startTime}` : new Date().toISOString()),
    validUntil: passDoc.validUntil || (booking ? `${booking.date}T${booking.endTime}` : new Date(Date.now() + 86400000).toISOString()),
    maxUses: passDoc.maxUses ?? 1,
    currentUses: passDoc.currentUses ?? 0,
    checkedInAt: passDoc.checkedInAt || (checkInTimestamp ? String(checkInTimestamp) : undefined),
    checkedOutAt: passDoc.checkedOutAt || (checkOutTimestamp ? String(checkOutTimestamp) : undefined),
    status: passDoc.status || (passDoc.isRevoked ? 'REVOKED' : checkOutTimestamp ? 'USED' : 'ACTIVE'),
    checkInTimestamp,
    checkOutTimestamp,
    gateId: passDoc.gateId || null,
    isRevoked: Boolean(passDoc.isRevoked || passDoc.status === 'REVOKED'),
    revokedAt: passDoc.revokedAt || null,
    revokedReason: passDoc.revokedReason || null,
    inspectionDetails: passDoc.inspectionDetails || null,
    passTokenHash: passDoc.passTokenHash,
    createdAt: passDoc.createdAt || new Date().toISOString(),
    updatedAt: passDoc.updatedAt || new Date().toISOString(),
    resident: resident || undefined,
    facility: facility || undefined,
    booking: booking || undefined,
    organisation: organisation || undefined,
    guard: guard || undefined,
  };
};

export const normalizeAvailabilityFromApi = (
  raw: ApiAvailabilityResponse
): AmenityAvailabilityResult => {
  return {
    isAvailable: Boolean(raw.isAvailable),
    available: Boolean(raw.isAvailable),
    reason: raw.reason,
    availableUnits: raw.availableUnits,
    maxCapacity: raw.maxCapacity,
    effectiveStartDateTime: raw.effectiveStartDateTime,
    effectiveEndDateTime: raw.effectiveEndDateTime,
  };
};
