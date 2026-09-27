import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import '../assessment/assessment.model.js';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: [true, 'Invoice number is required'],
      default: uuidv4,
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Community ID is required'],
      index: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Target User ID is required'],
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Villa',
      required: [true, 'Unit ID is required'],
      index: true,
    },
    billingPeriodString: {
      type: String,
      required: [true, 'Billing period string is required'],
      index: true,
      validate: {
        validator: function (value) {
          // Format validation: YYYY-MM, YYYY-Qx, or YYYY-Wxx (e.g. 2026-03, 2026-Q1, or 2026-W36)
          return /^\d{4}-(?:[0-1]\d|Q[1-4]|W(?:0[1-9]|[1-4]\d|5[0-3]))$/.test(value);
        },
        message: (props) =>
          `${props.value} is not a valid billing period format. Use 'YYYY-MM', 'YYYY-Qx', or 'YYYY-Wxx' (e.g. '2026-07', '2026-Q3', or '2026-W36').`,
      },
    },
    // --- Enterprise Invoice Numbering ---
    fy: { type: String, required: false }, // Will make required later after migration
    sequenceNumber: { type: Number },

    // --- Invoice Snapshot (Immutable) ---
    snapshot: {
      assessmentName: String,
      assessmentType: String,
      calculationMethod: Object,
      unitDetails: Object,
      residentDetails: Object,
      billingConfiguration: Object
    },

    // --- Currency & Tax Snapshot (Immutable) ---
    currency: { type: String, default: 'INR' },
    subtotal: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    
    // --- Document Storage Versioning ---
    invoiceDocuments: [{
      documentId: String,
      generatedAt: Date,
      version: Number,
      url: String
    }],

    // --- Legacy Fields (Retained for Phase 1 Migration) ---
    hardcodedAmount: {
      type: Number,
      required: false,
    },
    totalDue: {
      type: Number,
      required: false,
    },
    paid_at: {
      type: Date,
      required: false,
    },

    // --- New Enterprise Fields ---
    currentCharge: {
      type: Number,
      required: [true, 'Current charge is required'],
    },
    previousOutstanding: {
      type: Number,
      default: 0,
    },
    lateFeeAmount: {
      type: Number,
      default: 0,
    },
    carryForwardHistory: [{
      invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
      invoiceNumber: String,
      amount: Number,
      billingPeriodString: String,
      generatedDate: Date,
    }],
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    outstandingAmount: {
      type: Number,
      required: [true, 'Outstanding amount is required'],
    },
    carryForwardEnabled: {
      type: Boolean,
      default: true,
    },
    invoiceVersion: {
      type: Number,
      default: 1,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    paymentCompletionDate: {
      type: Date,
      default: null,
    },
    
    // --- Payment Link Lifecycle ---
    paymentLinkId: { type: String, default: null },
    paymentLink: { type: String, default: null },
    paymentLinkStatus: { type: String, enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PAID'], default: null },
    paymentLinkGeneratedAt: { type: Date, default: null },
    paymentLinkExpiresAt: { type: Date, default: null },
    paymentLinkRegeneratedCount: { type: Number, default: 0 },

    // --- Billing Calendar & Retries ---
    penaltyDate: { type: Date, default: null },
    retryCount: { type: Number, default: 0 },

    // --- Billing Freeze ---
    isFrozen: { type: Boolean, default: false },
    frozenAt: { type: Date, default: null },
    frozenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // --- Approval & Cancellation State ---
    cancellationRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // --- Reminder Management ---
    reminderCount: { type: Number, default: 0 },
    lastReminderSentAt: { type: Date, default: null },
    nextReminderAt: { type: Date, default: null },
    reminderChannel: { type: String, enum: ['WHATSAPP', 'EMAIL', 'SMS', 'NONE'], default: 'NONE' },

    // --- Financial Audit Timeline (Expanded) ---
    auditHistory: [{
      action: { type: String, required: true },
      details: { type: String, default: '' },
      date: { type: Date, default: Date.now },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      userRole: { type: String, default: 'SYSTEM' },
      source: { type: String, enum: ['API', 'WEBHOOK', 'SCHEDULER', 'SYSTEM', 'ADMIN_PANEL', 'RESIDENT_APP'], default: 'SYSTEM' },
      ipAddress: { type: String, default: null },
      device: { type: String, default: null },
      reason: { type: String, default: null } 
    }],
    
    // --- Idempotency Support ---
    idempotencyKey: {
      type: String,
      index: { unique: true, sparse: true }
    },
    
    // --- Soft Delete Fields ---
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    paid_at: {
      type: Date,
      default: null,
    },
    settled_at: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VERIFICATION_PENDING', 'CANCELLED'],
        message: 'Status must be UNPAID, PARTIALLY_PAID, PAID, OVERDUE, VERIFICATION_PENDING, or CANCELLED',
      },
      default: 'UNPAID',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['UPI', 'CARD', 'NETBANKING', 'BANK_TRANSFER', 'NEFT', 'CASH', 'WALLET', 'RAZORPAY', 'CHEQUE', 'DEMAND_DRAFT'],
        message: 'Payment method must be UPI, CARD, NETBANKING, BANK_TRANSFER, NEFT, CASH, WALLET, RAZORPAY, CHEQUE, or DEMAND_DRAFT',
      },
      default: null,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization (orgId) is required'],
      index: true,
    },
    offlineReference: {
      type: String,
      default: null,
    },
    offlineAmount: {
      type: Number,
      default: null,
    },
    paymentScreenshot: {
      type: String,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    payerNotes: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: '__v',
  }
);

// Enforce composite unique constraint to prevent duplicate billing spam
invoiceSchema.index(
  { assessmentId: 1, targetUserId: 1, billingPeriodString: 1 },
  { unique: true }
);

// Multi-tenant query partitioning indexes
invoiceSchema.index({ communityId: 1, status: 1 });
invoiceSchema.index({ communityId: 1, targetUserId: 1 });
// Dashboard Queries, Sorting, and Carry Forward Lookup Indexes
invoiceSchema.index({ orgId: 1, status: 1 });
invoiceSchema.index({ orgId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ communityId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ offlineReference: 1 });
invoiceSchema.index({ targetUserId: 1, status: 1, isDeleted: 1, carryForwardEnabled: 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });

// --- Mongoose Pre-Save Financial Validation Hook ---
invoiceSchema.pre('save', function () {
  
  if (this.isFrozen) {
    if (this.isModified() && !this.isModified('isFrozen')) {
      throw new Error('Financial Integrity Error: Invoice is frozen. No modifications are allowed.');
    }
  }

  // Immutability Check for existing documents
  if (!this.isNew) {
    const immutableFields = [
      'snapshot', 'currency', 'subtotal', 'taxAmount',
      'currentCharge', 'previousOutstanding', 'totalAmount',
      'billingPeriodString', 'assessmentId'
    ];
    for (const field of immutableFields) {
      if (this.isModified(field)) {
         throw new Error(`Financial Integrity Error: ${field} is immutable and cannot be modified after generation.`);
      }
    }
  }

  // Ensure outstanding equation integrity
  // Note: Float math in JS can be tricky, rounding to 2 decimals
  const calculatedOutstanding = Math.round((this.totalAmount - this.paidAmount) * 100) / 100;
  this.outstandingAmount = calculatedOutstanding;

  if (this.outstandingAmount < 0) {
    throw new Error('Financial Integrity Error: Outstanding amount cannot be negative.');
  }
  
  if (this.outstandingAmount > this.totalAmount) {
     throw new Error('Financial Integrity Error: Outstanding amount cannot exceed total amount.');
  }

  // Automatic Status Calculation based on payments and due date
  // Do not alter CANCELLED or VERIFICATION_PENDING invoices
  if (this.status !== 'CANCELLED' && this.status !== 'VERIFICATION_PENDING') {
    const now = new Date();
    
    if (this.paidAmount === 0) {
      this.status = (this.dueDate && this.dueDate < now) ? 'OVERDUE' : 'UNPAID';
    } else if (this.paidAmount > 0 && this.outstandingAmount > 0) {
      this.status = (this.dueDate && this.dueDate < now) ? 'OVERDUE' : 'PARTIALLY_PAID';
    } else if (this.outstandingAmount <= 0) {
      this.status = 'PAID';
      if (!this.paymentCompletionDate) {
        this.paymentCompletionDate = now;
      }
    }
  }
});

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;

