import mongoose from 'mongoose';
import { MIGRATION_EXECUTION_MODES } from '../reconciliation.constants.js';

const historicalMigrationRunSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null, // null indicates multi-tenant/all-tenant run
      index: true,
    },
    mode: {
      type: String,
      enum: Object.values(MIGRATION_EXECUTION_MODES),
      required: true,
      default: MIGRATION_EXECUTION_MODES.DRY_RUN,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    options: {
      allowGenesis: { type: Boolean, default: false },
      domains: { type: [String], default: [] },
      dryRun: { type: Boolean, default: true },
    },
    inventorySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    summary: {
      totalProcessed: { type: Number, default: 0 },
      alreadyCanonical: { type: Number, default: 0 },
      matched: { type: Number, default: 0 },
      backfillRequired: { type: Number, default: 0 },
      backfilledPayments: { type: Number, default: 0 },
      backfilledLedgerEntries: { type: Number, default: 0 },
      genesisEntries: { type: Number, default: 0 },
      exceptionsCount: { type: Number, default: 0 },
      unmatchedCount: { type: Number, default: 0 },
      conflictCount: { type: Number, default: 0 },
      invalidCount: { type: Number, default: 0 },
      excludedCount: { type: Number, default: 0 },
      totalAmountReconciled: { type: Number, default: 0 },
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'historical_migration_runs',
  }
);

historicalMigrationRunSchema.index({ orgId: 1, createdAt: -1 });
historicalMigrationRunSchema.index({ mode: 1, status: 1 });

export const HistoricalMigrationRun = mongoose.model('HistoricalMigrationRun', historicalMigrationRunSchema);
export default HistoricalMigrationRun;
