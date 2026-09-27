import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  bookingId: {
    type: String,
    default: null
  },
  razorpay_order_id: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  razorpay_payment_id: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  // For a wallet cash-refund, this identifies the successful wallet top-up
  // Payment that Razorpay will refund back to its original UPI/card account.
  // Keeping this separate from referenceId avoids overloading booking links.
  sourcePaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
    index: true
  },
  razorpay_refund_id: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  type: {
    type: String,
    enum: ['Debit', 'Credit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    default: 'system'
  },
  paymentStatus: {
    type: String,
    enum: ['success', 'refunded', 'pending', 'failed'],
    default: 'success'
  },
  referenceType: {
    type: String,
    enum: ['AmenityBooking', 'Refund', 'Invoice', 'Recharge', 'Other'],
    default: 'AmenityBooking'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel',
    default: null
  },
  referenceModel: {
    type: String,
    enum: ['AmenityBooking', 'Invoice', 'Payment', 'Wallet', 'User'],
    default: 'AmenityBooking'
  },
  amenityName: {
    type: String,
    default: 'Unknown Amenity'
  },
  description: {
    type: String,
    default: ''
  }
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, orgId: 1, createdAt: -1 });
walletTransactionSchema.index({ sourcePaymentId: 1, paymentStatus: 1 });
walletTransactionSchema.index({ orgId: 1, referenceType: 1, referenceId: 1 });

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

const walletSchema = new mongoose.Schema({
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

walletSchema.index({ userId: 1, orgId: 1 }, { unique: true });

export const Wallet = mongoose.model('Wallet', walletSchema);
