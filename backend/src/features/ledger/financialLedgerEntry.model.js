import mongoose from 'mongoose';
import {
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
  FINANCIAL_DOMAINS,
  DEFAULT_CURRENCY,
} from './financialLedger.constants.js';

const ledgerLineSchema = new mongoose.Schema(
  {
    account: {
      type: String,
      required: [true, 'Account is required for ledger line'],
      trim: true,
    },
    entryType: {
      type: String,
      enum: Object.values(ENTRY_TYPES),
      required: [true, 'Entry type (DEBIT/CREDIT) is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required for ledger line'],
      min: [0.01, 'Amount must be greater than zero'],
    },
  },
  { _id: false }
);

const financialLedgerEntrySchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      index: true,
      trim: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization (tenant) ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    domain: {
      type: String,
      enum: Object.values(FINANCIAL_DOMAINS),
      required: [true, 'Financial domain is required'],
      index: true,
    },
    referenceType: {
      type: String,
      required: [true, 'Reference type is required'],
      index: true,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Reference ID is required'],
      index: true,
    },
    debitAccount: {
      type: String,
      required: [true, 'Debit account is required'],
      index: true,
      trim: true,
    },
    creditAccount: {
      type: String,
      required: [true, 'Credit account is required'],
      index: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Ledger transaction amount is required'],
      min: [0.01, 'Transaction amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: DEFAULT_CURRENCY,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(LEDGER_STATUSES),
      default: LEDGER_STATUSES.POSTED,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Deterministic idempotency key is required'],
      index: { unique: true },
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    entries: {
      type: [ledgerLineSchema],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length >= 2;
        },
        message: 'A double-entry transaction must contain at least two entries (one debit and one credit).',
      },
    },
  },
  {
    timestamps: true,
    collection: 'financial_ledger_entries',
  }
);

// Invariant 1 & 2: Double-Entry Balance Invariant Check before validation
financialLedgerEntrySchema.pre('validate', function () {
  // Auto-populate canonical paired entries if not explicitly provided
  if (!this.entries || this.entries.length === 0) {
    if (this.debitAccount && this.creditAccount && this.amount) {
      this.entries = [
        {
          account: this.debitAccount,
          entryType: ENTRY_TYPES.DEBIT,
          amount: this.amount,
        },
        {
          account: this.creditAccount,
          entryType: ENTRY_TYPES.CREDIT,
          amount: this.amount,
        },
      ];
    }
  }

  if (this.entries && this.entries.length > 0) {
    const totalDebit = this.entries
      .filter((e) => e.entryType === ENTRY_TYPES.DEBIT)
      .reduce((sum, e) => sum + Math.round(Number(e.amount) * 100), 0);

    const totalCredit = this.entries
      .filter((e) => e.entryType === ENTRY_TYPES.CREDIT)
      .reduce((sum, e) => sum + Math.round(Number(e.amount) * 100), 0);

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Double-entry balance invariant violated: Total Debits (₹${totalDebit / 100}) does not equal Total Credits (₹${totalCredit / 100})`
      );
    }
  }
});

// Invariant 5: Immutability Protection — Block updates and deletions
const blockUpdate = function () {
  throw new Error(
    'FinancialLedgerEntry is immutable. Direct updates are strictly forbidden. Use compensating journal entries.'
  );
};
financialLedgerEntrySchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], blockUpdate);

const blockDelete = function () {
  throw new Error('FinancialLedgerEntry is immutable. Deletions are strictly forbidden.');
};
financialLedgerEntrySchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'remove'], blockDelete);

// Compound indexes for optimal multi-tenant financial reporting
financialLedgerEntrySchema.index({ orgId: 1, createdAt: -1 });
financialLedgerEntrySchema.index({ orgId: 1, domain: 1, createdAt: -1 });
financialLedgerEntrySchema.index({ orgId: 1, debitAccount: 1 });
financialLedgerEntrySchema.index({ orgId: 1, creditAccount: 1 });
financialLedgerEntrySchema.index({ referenceType: 1, referenceId: 1 });

export const FinancialLedgerEntry = mongoose.model('FinancialLedgerEntry', financialLedgerEntrySchema);
export default FinancialLedgerEntry;
