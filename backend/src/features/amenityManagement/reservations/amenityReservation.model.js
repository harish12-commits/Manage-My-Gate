import mongoose from 'mongoose';

const pricingSnapshotSchema = new mongoose.Schema(
  {
    baseAmount: {
      type: Number,
      default: 0,
      min: [0, 'Base amount cannot be negative'],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Deposit amount cannot be negative'],
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
  },
  { _id: false }
);

const approvalActionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: {
        values: ['REQUESTED', 'APPROVED', 'REJECTED'],
        message: '{VALUE} is not a valid approval action',
      },
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const amenityReservationSchema = new mongoose.Schema(
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
    reservationNumber: {
      type: String,
      required: [true, 'Reservation number is required'],
      trim: true,
      uppercase: true,
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

    // THE FIVE ORTHOGONAL STATE DIMENSIONS
    bookingStatus: {
      type: String,
      required: [true, 'Booking status is required'],
      enum: {
        values: ['PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED', 'REJECTED'],
        message: '{VALUE} is not a valid bookingStatus',
      },
      default: 'CONFIRMED',
      index: true,
    },
    paymentStatus: {
      type: String,
      required: [true, 'Payment status is required'],
      enum: {
        values: [
          'NOT_REQUIRED',
          'NOT_APPLICABLE',
          'PENDING',
          'HELD_AUTHORIZED',
          'PAID',
          'REFUND_PENDING',
          'REFUNDED',
          'FAILED',
        ],
        message: '{VALUE} is not a valid paymentStatus',
      },
      default: 'NOT_REQUIRED',
      index: true,
    },
    approvalStatus: {
      type: String,
      required: [true, 'Approval status is required'],
      enum: {
        values: ['NOT_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'],
        message: '{VALUE} is not a valid approvalStatus',
      },
      default: 'NOT_REQUIRED',
      index: true,
    },
    accessStatus: {
      type: String,
      required: [true, 'Access status is required'],
      enum: {
        values: [
          'NOT_APPLICABLE',
          'PASS_GENERATED',
          'CHECKED_IN',
          'CHECKED_OUT',
          'ACCESS_REVOKED',
        ],
        message: '{VALUE} is not a valid accessStatus',
      },
      default: 'NOT_APPLICABLE',
      index: true,
    },
    completionStatus: {
      type: String,
      required: [true, 'Completion status is required'],
      enum: {
        values: ['PENDING', 'COMPLETED', 'NO_SHOW', 'ABANDONED'],
        message: '{VALUE} is not a valid completionStatus',
      },
      default: 'PENDING',
      index: true,
    },

    pricingSnapshot: {
      type: pricingSnapshotSchema,
      default: () => ({}),
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: ['NONE', 'WALLET', 'RAZORPAY'],
      default: 'NONE',
    },
    // Audit references are written only after the backend has settled the
    // selected payment method; they are never accepted as proof from the app.
    paymentReference: {
      type: String,
      default: null,
      trim: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refund amount cannot be negative'],
    },
    refundMethod: {
      type: String,
      enum: ['WALLET', 'RAZORPAY', null],
      default: null,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Deposit amount cannot be negative'],
    },
    approvalHistory: {
      type: [approvalActionSchema],
      default: [],
    },
    approvalDeadline: {
      type: Date,
      default: null,
    },
    paymentDeadline: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: [0, 'Version cannot be negative'],
    },
  },
  {
    timestamps: true,
    collection: 'amenity_management_reservations',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual properties for backward and cross-layer compatibility
amenityReservationSchema.virtual('startDateTime').get(function () {
  return this.effectiveStartDateTime || this.requestedStartDateTime;
});

amenityReservationSchema.virtual('endDateTime').get(function () {
  return this.effectiveEndDateTime || this.requestedEndDateTime;
});

// Indexes
amenityReservationSchema.index(
  { orgId: 1, reservationNumber: 1 },
  { unique: true, name: 'idx_amenity_resv_org_number_unique' }
);

amenityReservationSchema.index(
  { orgId: 1, resourceId: 1, effectiveStartDateTime: 1, effectiveEndDateTime: 1, bookingStatus: 1 },
  { name: 'idx_amenity_resv_org_res_range_booking_status' }
);

amenityReservationSchema.index(
  { orgId: 1, residentId: 1, createdAt: -1 },
  { name: 'idx_amenity_resv_org_resident_history' }
);

amenityReservationSchema.index(
  { orgId: 1, unitId: 1, createdAt: -1 },
  { name: 'idx_amenity_resv_org_unit_history' }
);

export const AmenityReservation =
  mongoose.models.AmenityReservation ||
  mongoose.model(
    'AmenityReservation',
    amenityReservationSchema,
    'amenity_management_reservations'
  );

export default AmenityReservation;
