import mongoose from 'mongoose';
import crypto from 'crypto';

const walletLedgerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Transaction amount is required'],
    min: [0, 'Amount must be positive']
  },
  transactionType: {
    type: String,
    enum: ['credit', 'debit'],
    required: [true, 'Transaction type is required']
  },
  referenceBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AmenityBooking',
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  previousHash: {
    type: String,
    required: true,
    default: 'GENESIS' // The very first transaction for a user will have 'GENESIS'
  },
  hash: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Phase 8 Deprecation & Hardening: Prevent all new writes to obsolete WalletLedger
const blockSave = function(next) { 
  const err = new Error('WalletLedger is deprecated. All financial accounting mutations must use FinancialLedgerEntry.'); 
  if (typeof next === 'function') return next(err);
  throw err;
};
walletLedgerSchema.pre(['validate', 'save'], blockSave);

// Immutable append-only log: prevent updates and deletions
const blockUpdate = function(next) { 
  const err = new Error('WalletLedger is deprecated. Updates are strictly forbidden.'); 
  if (typeof next === 'function') return next(err);
  throw err;
};
walletLedgerSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], blockUpdate);

const blockDelete = function(next) { 
  const err = new Error('WalletLedger is deprecated. Deletions are strictly forbidden.'); 
  if (typeof next === 'function') return next(err);
  throw err;
};
walletLedgerSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'remove'], blockDelete);

// Middleware to calculate cryptographic hash before saving
walletLedgerSchema.pre('validate', async function (next) {
  if (this.isNew) {
    // 1. Fetch the absolute latest entry for this user to get the true previousHash
    const lastEntry = await this.constructor.findOne({ userId: this.userId }).sort({ createdAt: -1 });
    
    this.previousHash = lastEntry ? lastEntry.hash : 'GENESIS';
    
    // 2. Generate the cryptographic hash for the new entry
    const dataString = `${this.userId.toString()}|${this.amount}|${this.transactionType}|${this.referenceBookingId ? this.referenceBookingId.toString() : 'null'}|${this.previousHash}`;
    this.hash = crypto.createHash('sha256').update(dataString).digest('hex');
  }
  next();
});

// Enforce sequence integrity at the DB engine level to prevent ledger forking
walletLedgerSchema.index({ userId: 1, previousHash: 1 }, { unique: true });

export default mongoose.model('WalletLedger', walletLedgerSchema);
