import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['Draft', 'Pending', 'Active', 'Rejected'],
      default: 'Active',
    },
    organizationType: {
      type: String,
      enum: ['Residential', 'Corporate', 'Educational', 'Commercial', 'Other'],
      required: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    expectedMemberCount: {
      type: Number,
      min: 1,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    // ISO 3166-1 alpha-2; default country for phone numbers typed without a country code.
    countryCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'IN',
    },
    allowedFeatures: {
      type: [String],
      default: [],
    },
    isPlatform: {
      type: Boolean,
      default: false,
    },
    featureFlags: {
      enableEventStore: { type: Boolean, default: true },
      enableAdjustments: { type: Boolean, default: true },
      enableLedger: { type: Boolean, default: true },
      enableApprovalWorkflow: { type: Boolean, default: true },
      enableLateFeeEngine: { type: Boolean, default: true },
    },
    financialSettings: {
      fyStartMonth: { type: Number, default: 4 }, // April
      fyEndMonth: { type: Number, default: 3 }, // March
      currentFy: { type: String, default: '2026-2027' },
      invoicePrefix: { type: String, default: 'ORG' },
      invoiceSequenceResetPolicy: { type: String, enum: ['NEVER', 'YEARLY', 'MONTHLY'], default: 'YEARLY' },
      billingConfigVersion: { type: Number, default: 1 },
    },
    billingSettings: {
      allowAdvancePayments: { type: Boolean, default: false },
      allowPartialPayments: { type: Boolean, default: true },
      allowNegativeBalance: { type: Boolean, default: false },
      autoApplyCreditNotes: { type: Boolean, default: true },
      autoApplyCarryForward: { type: Boolean, default: true },
      autoCloseSmallOutstandingBalance: { type: Boolean, default: false },
      minimumPaymentAmount: { type: Number, default: 10 },
      maximumPartialPaymentAttempts: { type: Number, default: 5 },
      
      penaltyEngine: {
        type: { type: String, enum: ['FLAT', 'PERCENTAGE', 'DAILY', 'MONTHLY', 'NONE'], default: 'NONE' },
        value: { type: Number, default: 0 },
        gracePeriodDays: { type: Number, default: 0 },
        maxPenaltyLimit: { type: Number, default: null }
      },

      approvalWorkflows: {
        refundRequiresApproval: { type: Boolean, default: true },
        writeOffRequiresApproval: { type: Boolean, default: true },
        creditNoteRequiresApproval: { type: Boolean, default: true },
        cancellationRequiresApproval: { type: Boolean, default: true },
      },

      carryForwardEnabled: { type: Boolean, default: true },
      combineOutstandingInvoices: { type: Boolean, default: false },
      autoGeneratePaymentLinks: { type: Boolean, default: true },
      autoSendWhatsApp: { type: Boolean, default: true },
      overdueGracePeriodDays: { type: Number, default: 0 },
      autoMarkOverdue: { type: Boolean, default: true },
      notificationChannels: { type: [String], default: ['WHATSAPP', 'EMAIL'] },
      billingFrozenPeriods: { type: [String], default: [] }
    },
  },
  {
    timestamps: true,
  }
);

// Enforce database-level case-insensitive uniqueness on organization name
organizationSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
