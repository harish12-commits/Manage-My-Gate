import mongoose from 'mongoose';

const pricingSnapshotSchema = new mongoose.Schema(
  {
    baseAmount: { type: Number, default: 0 },
    tier: { type: String, default: null },
    taxAmount: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  { _id: false }
);

const amenityReservationHoldSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AmenityFacility',
      required: [true, 'Facility ID is required'],
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AmenityResource',
      default: null,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Resident ID is required'],
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Villa',
      required: [true, 'Unit ID is required'],
      index: true,
    },
    requestedStartDateTime: {
      type: Date,
      required: [true, 'Requested start datetime is required'],
    },
    requestedEndDateTime: {
      type: Date,
      required: [true, 'Requested end datetime is required'],
    },
    effectiveStartDateTime: {
      type: Date,
      required: [true, 'Effective start datetime is required'],
      index: true,
    },
    effectiveEndDateTime: {
      type: Date,
      required: [true, 'Effective end datetime is required'],
      index: true,
    },
    headcount: {
      type: Number,
      default: 1,
      min: [1, 'Headcount must be at least 1'],
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    holdType: {
      type: String,
      required: [true, 'Hold type is required'],
      enum: {
        values: ['STANDARD', 'ADMIN_REVIEW', 'PAYMENT_PENDING'],
        message: '{VALUE} is not a valid hold type',
      },
      default: 'STANDARD',
    },
    status: {
      type: String,
      required: [true, 'Hold status is required'],
      enum: {
        values: ['ACTIVE', 'PROMOTED', 'EXPIRED', 'RELEASED'],
        message: '{VALUE} is not a valid hold status',
      },
      default: 'ACTIVE',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Hold expiration datetime is required'],
      index: true,
    },
    pricingSnapshot: {
      type: pricingSnapshotSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'amenity_management_reservation_holds',
  }
);

// TTL Index for ephemeral cleanup
amenityReservationHoldSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idx_reservation_holds_ttl' }
);

amenityReservationHoldSchema.index(
  { orgId: 1, resourceId: 1, effectiveStartDateTime: 1, effectiveEndDateTime: 1, status: 1 },
  { name: 'idx_resv_holds_org_res_range_status' }
);

amenityReservationHoldSchema.index(
  { orgId: 1, residentId: 1, status: 1 },
  { name: 'idx_resv_holds_org_resident_status' }
);

amenityReservationHoldSchema.index(
  { orgId: 1, unitId: 1, status: 1 },
  { name: 'idx_resv_holds_org_unit_status' }
);

export const AmenityReservationHold =
  mongoose.models.AmenityReservationHold ||
  mongoose.model(
    'AmenityReservationHold',
    amenityReservationHoldSchema,
    'amenity_management_reservation_holds'
  );

export default AmenityReservationHold;
