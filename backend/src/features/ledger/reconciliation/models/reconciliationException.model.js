import mongoose from 'mongoose';
import {
  RECONCILIATION_CLASSIFICATIONS,
  RECONCILIATION_EXCEPTION_STATUSES,
  RECONCILIATION_SOURCE_TYPES,
  RECONCILIATION_DOMAINS,
} from '../reconciliation.constants.js';

const discrepancyDetailsSchema = new mongoose.Schema(
  {
    expectedAmount: { type: Number, default: 0 },
    actualAmount: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const reconciliationExceptionSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization (tenant) ID is required'],
      index: true,
    },
    sourceType: {
      type: String,
      enum: Object.values(RECONCILIATION_SOURCE_TYPES),
      required: [true, 'Source type is required'],
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Source record ID is required'],
      index: true,
    },
    domain: {
      type: String,
      enum: Object.values(RECONCILIATION_DOMAINS),
      required: [true, 'Financial domain is required'],
      index: true,
    },
    classification: {
      type: String,
      enum: Object.values(RECONCILIATION_CLASSIFICATIONS),
      required: [true, 'Reconciliation classification is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for exception is required'],
      trim: true,
    },
    discrepancyDetails: {
      type: discrepancyDetailsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: Object.values(RECONCILIATION_EXCEPTION_STATUSES),
      default: RECONCILIATION_EXCEPTION_STATUSES.OPEN,
      index: true,
    },
    resolutionNotes: {
      type: String,
      default: '',
      trim: true,
    },
    runId: {
      type: String,
      default: null,
      index: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'reconciliation_exceptions',
  }
);

reconciliationExceptionSchema.index({ orgId: 1, status: 1 });
reconciliationExceptionSchema.index({ orgId: 1, domain: 1, status: 1 });
reconciliationExceptionSchema.index({ sourceType: 1, sourceId: 1 });
reconciliationExceptionSchema.index({ runId: 1, status: 1 });

export const ReconciliationException = mongoose.model('ReconciliationException', reconciliationExceptionSchema);
export default ReconciliationException;
