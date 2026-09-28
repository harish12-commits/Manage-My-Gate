import { AmenityArchetype, AmenityPricingType } from '../types/amenityDomain.types';

export type EventBookingMode = 'FULL_DAY' | 'SESSION' | 'HOURLY';
export type RoomStayMode = 'HOURLY' | 'OVERNIGHT';
export type PaymentCollectionMode = 'FULL' | 'ADVANCE' | 'PAY_AT_GATE';

export interface EventSessionForm {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  price: number | string;
}

export interface AmenityCreationFormState {
  // Basic Info
  name: string;
  code: string;
  archetype: AmenityArchetype;
  category: string;
  location: string;
  status: 'active' | 'inactive' | 'draft';
  imageUrl?: string;
  description?: string;

  // Operating Schedule
  openTime: string;
  closeTime: string;
  openDays: number[]; // 0 to 6

  // Specifications
  maxCapacity: number | string;
  maxHeadcountPerReservation: number | string;
  slotDurationMinutes: number | string;
  bufferTimeMinutes: number | string;
  advanceBookingDays: number | string;
  advanceNoticeHours: number | string;
  requiresApproval: boolean;
  isMultiResourceFacility: boolean;
  subRooms?: Array<{ id: string; name: string; capacity: number }>;
  roomAmenities?: string[];
  availableStock?: number | string;
  maxLoanHours?: number | string;
  requiresInspection?: boolean;

  // Event spaces: how the venue is booked
  bookingMode?: EventBookingMode;
  sessions?: EventSessionForm[];

  // Rooms: hourly or overnight stays
  stayMode?: RoomStayMode;
  checkInTime?: string;
  checkOutTime?: string;
  maxNights?: number | string;

  // How the price is collected
  paymentMode?: PaymentCollectionMode;
  advanceType?: 'FIXED' | 'PERCENT';
  advanceValue?: number | string;

  // Pricing & Policies
  pricingType: AmenityPricingType;
  baseRate: number | string;
  securityDeposit: number | string;
  securityDepositDescription?: string;
  isCancellationAllowed: boolean;
  refundCutoffHours: number | string;
  refundPercentage: number | string;
}

/**
 * Maps and sanitizes the Creation Wizard form state into a strictly conforming
 * payload for backend amenityFacility.model.js, eliminating schema pollution.
 */
export function mapAmenityCreationPayloadStrategy(
  form: AmenityCreationFormState,
  isDraft = false
) {
  // Format HH:MM safely
  const formatTime = (t?: string, defaultVal = '06:00') => {
    if (!t) return defaultVal;
    const trimmed = t.trim();
    if (!trimmed) return defaultVal;
    if (/^\d:[0-5]\d$/.test(trimmed)) return `0${trimmed}`;
    return trimmed;
  };

  const openTime = formatTime(form.openTime, '06:00');
  const closeTime = formatTime(form.closeTime, '22:00');

  // Build full 7-day operating hours array
  const operatingHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    openTime,
    closeTime,
    isOpen: form.openDays.includes(day),
  }));

  // Resolve pricing
  const numBaseRate = Math.max(0, parseFloat(String(form.baseRate || 0)) || 0);
  const numDeposit = Math.max(0, parseFloat(String(form.securityDeposit || 0)) || 0);

  const pricingConfig = {
    pricingType: form.pricingType || 'FREE',
    baseRate: form.pricingType === 'FREE' ? 0 : numBaseRate,
    currency: 'INR',
    securityDeposit: numDeposit,
    taxPercentage: 0,
    cancellationFee: 0,
  };

  // 0 is a meaningful value for both (no cutoff / no refund); only blanks fall back.
  const intOr = (value: unknown, fallback: number) => {
    const n = parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const cancellationPolicy = {
    isAllowed: form.isCancellationAllowed ?? true,
    refundCutoffHours: Math.max(0, intOr(form.refundCutoffHours, 24)),
    refundPercentage: Math.min(100, Math.max(0, intOr(form.refundPercentage, 100))),
  };

  // Free facilities collect only a deposit, in full, when booked.
  const paymentMode: PaymentCollectionMode =
    form.pricingType === 'FREE' ? 'FULL' : form.paymentMode || 'FULL';
  const paymentPolicy = {
    mode: paymentMode,
    advanceType: form.advanceType || 'PERCENT',
    advanceValue: paymentMode === 'ADVANCE' ? Math.max(0, parseFloat(String(form.advanceValue || 0)) || 0) : 0,
  };

  const effectiveIsDraft = Boolean(isDraft || (form.status as string) === 'draft');
  const status = effectiveIsDraft
    ? 'DRAFT'
    : form.status === 'inactive'
    ? 'INACTIVE'
    : 'ACTIVE';
  const isActive = effectiveIsDraft ? false : form.status !== 'inactive';

  // Base facility object
  const basePayload: any = {
    name: form.name.trim(),
    code: (form.code || form.name.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()).trim(),
    archetype: form.archetype,
    category: form.category || 'General',
    location: form.location?.trim() || 'Clubhouse / Community Center',
    description: form.description?.trim() || '',
    timezone: 'Asia/Kolkata',
    operatingHours,
    pricingConfig,
    cancellationPolicy,
    paymentPolicy,
    advanceBookingDays: Math.max(1, parseInt(String(form.advanceBookingDays || 7), 10) || 7),
    isActive,
    status,
    isDraft: effectiveIsDraft,
    images: form.imageUrl ? [form.imageUrl] : [],
    imageUrl: form.imageUrl || '',
  };

  // Archetype-specific attributes & isolation
  switch (form.archetype) {
    case 'SHARED_CAPACITY': {
      const cap = Math.max(1, parseInt(String(form.maxCapacity || 50), 10) || 50);
      const quota = Math.max(
        1,
        parseInt(String(form.maxHeadcountPerReservation || 2), 10) || 2
      );
      return {
        ...basePayload,
        maxCapacity: cap,
        maxHeadcountPerReservation: quota,
        requiresApproval: false,
        slotDurationMinutes: 60,
        setupBufferMinutes: 0,
      };
    }

    case 'EXCLUSIVE_HOURLY': {
      const slotDuration = Math.max(
        15,
        parseInt(String(form.slotDurationMinutes || 60), 10) || 60
      );
      const buffer = Math.max(0, parseInt(String(form.bufferTimeMinutes || 0), 10) || 0);
      const advanceDays = Math.max(
        1,
        parseInt(String(form.advanceBookingDays || 7), 10) || 7
      );
      return {
        ...basePayload,
        maxCapacity: 1,
        slotDurationMinutes: slotDuration,
        setupBufferMinutes: buffer,
        advanceBookingDays: advanceDays,
        requiresApproval: false,
      };
    }

    case 'EVENT_SPACE': {
      const advanceDays = Math.max(
        1,
        parseInt(String(form.advanceBookingDays || 30), 10) || 30
      );
      const advanceNotice = Math.max(
        0,
        parseInt(String(form.advanceNoticeHours || 72), 10) || 72
      );
      const bookingMode: EventBookingMode = form.bookingMode || 'FULL_DAY';
      return {
        ...basePayload,
        maxCapacity: Math.max(1, parseInt(String(form.maxCapacity || 100), 10) || 100),
        requiresApproval: form.requiresApproval ?? true,
        advanceBookingDays: advanceDays,
        minNoticeHours: advanceNotice,
        bookingMode,
        sessions:
          bookingMode === 'SESSION'
            ? (form.sessions || []).map((s) => ({
                name: s.name.trim(),
                startTime: formatTime(s.startTime),
                endTime: formatTime(s.endTime),
                price: String(s.price ?? '').trim() === '' ? null : Math.max(0, parseFloat(String(s.price)) || 0),
              }))
            : [],
        // Hourly events book on a slot grid; full-day and session bookings use their own windows.
        slotDurationMinutes:
          bookingMode === 'HOURLY' ? Math.max(15, parseInt(String(form.slotDurationMinutes || 60), 10) || 60) : 720,
      };
    }

    case 'ROOM_RESOURCE': {
      const stayMode: RoomStayMode = form.stayMode || 'HOURLY';
      return {
        ...basePayload,
        maxCapacity: Math.max(1, parseInt(String(form.maxCapacity || 10), 10) || 10),
        stayMode,
        ...(stayMode === 'OVERNIGHT'
          ? {
              checkInTime: formatTime(form.checkInTime, '14:00'),
              checkOutTime: formatTime(form.checkOutTime, '11:00'),
              maxNights: Math.max(1, parseInt(String(form.maxNights || 1), 10) || 1),
            }
          : {}),
        isMultiResourceFacility: form.isMultiResourceFacility ?? true,
        slotDurationMinutes: Math.max(
          15,
          parseInt(String(form.slotDurationMinutes || 60), 10) || 60
        ),
        setupBufferMinutes: 10,
        subRooms: form.subRooms || [],
        roomAmenities: form.roomAmenities || [],
      };
    }

    case 'INVENTORY_TOOLS': {
      const stock = Math.max(1, parseInt(String(form.availableStock || 1), 10) || 1);
      const loanHours = Math.max(1, parseInt(String(form.maxLoanHours || 24), 10) || 24);
      return {
        ...basePayload,
        maxCapacity: stock,
        availableStock: stock,
        maxLoanHours: loanHours,
        requiresInspection: form.requiresInspection ?? true,
        slotDurationMinutes: loanHours * 60,
      };
    }

    default:
      return basePayload;
  }
}
