import mongoose from 'mongoose';

const amenityOutboxEventSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Outbox event type is required'],
      trim: true,
      enum: {
        values: [
          'RESERVATION_CONFIRMED',
          'RESERVATION_CANCELLED',
          'GATE_PASS_ISSUED',
          'REFUND_DISPATCH_REQUIRED',
          'WAITLIST_RELEASED',
          'MAINTENANCE_SCHEDULED',
          'EMERGENCY_MAINTENANCE_DECLARED',
          'RECURRING_MAINTENANCE_SCHEDULED',
          'MAINTENANCE_EXTENDED',
          'MAINTENANCE_COMPLETED',
          'MAINTENANCE_CANCELLED',
          'APPROVAL_REQUESTED',
          'HOLD_EXPIRED',
          'FACILITY_CREATED',
          'FACILITY_PUBLISHED',
          'FACILITY_DEACTIVATED',
          'RESERVATION_CANCELLED_BY_ADMIN',
          'REFUND_REQUESTED',
          'APPROVAL_EXPIRED',
          'RESERVATION_REVIEW_REQUIRED',
          'RESERVATION_REVIEW_RESOLVED',
          'RESERVATION_COMPLETED',
          'RESERVATION_RESCHEDULED',
        ],
        message: '{VALUE} is not a valid outbox event type',
      },
    },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Aggregate ID is required'],
      index: true,
    },
    aggregateType: {
      type: String,
      required: [true, 'Aggregate type is required'],
      trim: true,
      uppercase: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Outbox payload is required'],
    },
    status: {
      type: String,
      required: [true, 'Outbox event status is required'],
      enum: {
        values: ['PENDING', 'PROCESSING', 'PUBLISHED', 'DEAD_LETTER'],
        message: '{VALUE} is not a valid outbox event status',
      },
      default: 'PENDING',
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: [0, 'Retry count cannot be negative'],
    },
    maxRetries: {
      type: Number,
      default: 5,
      min: [1, 'Max retries must be at least 1'],
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'amenity_management_outbox_events',
  }
);

// Worker polling index
amenityOutboxEventSchema.index(
  { status: 1, nextRetryAt: 1 },
  { name: 'idx_amenity_outbox_polling' }
);

amenityOutboxEventSchema.index(
  { status: 1, processingStartedAt: 1 },
  { name: 'idx_amenity_outbox_stale_processing' }
);

amenityOutboxEventSchema.index(
  { orgId: 1, aggregateId: 1 },
  { name: 'idx_amenity_outbox_org_aggregate' }
);

export const AmenityOutboxEvent =
  mongoose.models.AmenityOutboxEvent ||
  mongoose.model(
    'AmenityOutboxEvent',
    amenityOutboxEventSchema,
    'amenity_management_outbox_events'
  );

export default AmenityOutboxEvent;
