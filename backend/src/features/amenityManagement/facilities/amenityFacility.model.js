import mongoose from 'mongoose';

/**
 * Validates whether a given string is a valid IANA timezone identifier.
 * @param {string} tz
 * @returns {boolean}
 */
const isValidTimezone = (tz) => {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
};

const operatingHoursSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: [0, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
      max: [6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
    },
    openTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):?([0-5]\d)$/, 'Please provide a valid openTime format (HH:MM)'],
    },
    closeTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):?([0-5]\d)$/, 'Please provide a valid closeTime format (HH:MM)'],
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const pricingConfigSchema = new mongoose.Schema(
  {
    pricingType: {
      type: String,
      enum: ['FREE', 'HOURLY', 'DAILY', 'FIXED_EVENT', 'TIERED'],
      default: 'FREE',
    },
    baseRate: {
      type: Number,
      default: 0,
      min: [0, 'Base rate cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    securityDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Security deposit cannot be negative'],
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Tax percentage cannot be negative'],
      max: [100, 'Tax percentage cannot exceed 100%'],
    },
    cancellationFee: {
      type: Number,
      default: 0,
      min: [0, 'Cancellation fee cannot be negative'],
    },
  },
  { _id: false }
);

const cancellationPolicySchema = new mongoose.Schema(
  {
    isAllowed: {
      type: Boolean,
      default: true,
    },
    refundCutoffHours: {
      type: Number,
      default: 24,
      min: [0, 'Refund cutoff hours cannot be negative'],
    },
    refundPercentage: {
      type: Number,
      default: 100,
      min: [0, 'Refund percentage cannot be negative'],
      max: [100, 'Refund percentage cannot exceed 100%'],
    },
  },
  { _id: false }
);

const subRoomSchema = new mongoose.Schema(
  {
    id: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const eventSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Session startTime must be HH:MM'] },
    endTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Session endTime must be HH:MM'] },
    // Optional flat price for this session; falls back to pricingConfig.baseRate.
    price: { type: Number, default: null, min: [0, 'Session price cannot be negative'] },
  },
  { _id: false }
);

const amenityFacilitySchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Facility name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Facility code is required'],
      trim: true,
      uppercase: true,
    },
    archetype: {
      type: String,
      required: [true, 'Facility archetype is required'],
      enum: {
        values: [
          'SHARED_CAPACITY',
          'EXCLUSIVE_HOURLY',
          'EVENT_SPACE',
          'ROOM_RESOURCE',
          'INVENTORY_TOOLS',
        ],
        message: '{VALUE} is not a valid facility archetype',
      },
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    images: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
      default: 'UTC',
      validate: {
        validator: isValidTimezone,
        message: 'Please provide a valid IANA timezone identifier (e.g. Asia/Kolkata, UTC)',
      },
    },
    operatingHours: {
      type: [operatingHoursSchema],
      default: () => [
        { dayOfWeek: 0, openTime: '06:00', closeTime: '22:00', isOpen: true },
        { dayOfWeek: 1, openTime: '06:00', closeTime: '22:00', isOpen: true },
        { dayOfWeek: 2, openTime: '06:00', closeTime: '22:00', isOpen: true },
        { dayOfWeek: 3, openTime: '06:00', closeTime: '22:00', isOpen: true },
        { dayOfWeek: 4, openTime: '06:00', closeTime: '22:00', isOpen: true },
        { dayOfWeek: 5, openTime: '06:00', closeTime: '22:00', isOpen: true },
        { dayOfWeek: 6, openTime: '06:00', closeTime: '22:00', isOpen: true },
      ],
    },
    slotDurationMinutes: {
      type: Number,
      default: 60,
      min: [15, 'Slot duration must be at least 15 minutes'],
    },
    maxCapacity: {
      type: Number,
      default: 1,
      min: [1, 'Maximum capacity must be at least 1'],
    },
    maxHeadcountPerReservation: {
      type: Number,
      default: 2,
      min: [1, 'Maximum headcount per reservation must be at least 1'],
    },
    setupBufferMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Setup buffer minutes cannot be negative'],
    },
    advanceBookingDays: {
      type: Number,
      default: 7,
      min: [1, 'Advance booking days must be at least 1 day'],
    },
    minNoticeHours: {
      type: Number,
      default: 0,
      min: [0, 'Minimum notice hours cannot be negative'],
    },
    isMultiResourceFacility: {
      type: Boolean,
      default: false,
    },
    subRooms: {
      type: [subRoomSchema],
      default: [],
    },
    roomAmenities: {
      type: [String],
      default: [],
    },
    availableStock: {
      type: Number,
      default: 1,
      min: [0, 'Available stock cannot be negative'],
    },
    maxLoanHours: {
      type: Number,
      default: 24,
      min: [1, 'Maximum loan hours must be at least 1'],
    },
    requiresInspection: {
      type: Boolean,
      default: true,
    },
    // EVENT_SPACE: how the venue is booked.
    bookingMode: {
      type: String,
      enum: ['FULL_DAY', 'SESSION', 'HOURLY'],
      default: 'FULL_DAY',
    },
    sessions: {
      type: [eventSessionSchema],
      default: [],
    },
    // ROOM_RESOURCE: hourly rooms or overnight stays.
    stayMode: {
      type: String,
      enum: ['HOURLY', 'OVERNIGHT'],
      default: 'HOURLY',
    },
    checkInTime: {
      type: String,
      default: '14:00',
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'checkInTime must be HH:MM'],
    },
    checkOutTime: {
      type: String,
      default: '11:00',
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'checkOutTime must be HH:MM'],
    },
    maxNights: {
      type: Number,
      default: 7,
      min: [1, 'maxNights must be at least 1'],
    },
    pricingConfig: {
      type: pricingConfigSchema,
      default: () => ({}),
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    cancellationPolicy: {
      type: cancellationPolicySchema,
      default: () => ({}),
    },
    // How the price is collected: all when booking, an advance + balance, or at the gate.
    paymentPolicy: {
      mode: { type: String, enum: ['FULL', 'ADVANCE', 'PAY_AT_GATE'], default: 'FULL' },
      advanceType: { type: String, enum: ['FIXED', 'PERCENT'], default: 'PERCENT' },
      advanceValue: { type: Number, default: 0, min: [0, 'Advance cannot be negative'] },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
      index: true,
    },
    isDraft: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    concurrencyVersion: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Concurrency version cannot be negative'],
    },
  },
  {
    timestamps: true,
    collection: 'amenity_management_facilities',
  }
);

// Indexes
amenityFacilitySchema.index(
  { orgId: 1, code: 1 },
  { unique: true, name: 'idx_amenity_facility_org_code_unique' }
);
amenityFacilitySchema.index(
  { orgId: 1, archetype: 1, isActive: 1, isDeleted: 1 },
  { name: 'idx_amenity_facility_org_archetype_active' }
);
amenityFacilitySchema.index(
  { orgId: 1, isDraft: 1, isActive: 1, isDeleted: 1 },
  { name: 'idx_amenity_facility_org_draft_active' }
);

export const AmenityFacility =
  mongoose.models.AmenityFacility ||
  mongoose.model('AmenityFacility', amenityFacilitySchema, 'amenity_management_facilities');

export default AmenityFacility;
