/**
 * NAHOM Unified Payment & Financial Foundation
 * Canonical Financial Constants, Status Lifecycles & Mapping Utilities
 * 
 * Phase 2 - Additive Infrastructure Layer
 */

// 1. Canonical Payment Domains
export const PAYMENT_DOMAINS = Object.freeze({
  INVOICE: 'INVOICE',
  AMENITY: 'AMENITY',
  WALLET: 'WALLET',
});

// 2. Canonical Payment Methods
export const CANONICAL_PAYMENT_METHODS = Object.freeze({
  ONLINE: 'ONLINE',
  WALLET: 'WALLET',
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  BANK_TRANSFER: 'BANK_TRANSFER',
});

// 3. Canonical Payment Status Lifecycle
export const CANONICAL_PAYMENT_STATUSES = Object.freeze({
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUND_PENDING: 'REFUND_PENDING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
});

// 4. Canonical Reference Types
export const PAYMENT_REFERENCE_TYPES = Object.freeze({
  INVOICE: 'Invoice',
  AMENITY_BOOKING: 'AmenityBooking',
  WALLET_RECHARGE: 'WalletRecharge',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
});

// 5. Currency Standards
export const DEFAULT_CURRENCY = 'INR';
export const SUPPORTED_CURRENCIES = Object.freeze(['INR']);

// 6. Supported Gateway Providers
export const GATEWAY_PROVIDERS = Object.freeze({
  RAZORPAY: 'razorpay',
  MOCK: 'mock',
});

/**
 * Maps any legacy or provider payment method string into a Canonical Payment Method.
 * @param {string} legacyMethod
 * @returns {string} Canonical Payment Method
 */
export function toCanonicalPaymentMethod(legacyMethod) {
  if (!legacyMethod || typeof legacyMethod !== 'string') {
    return CANONICAL_PAYMENT_METHODS.ONLINE;
  }

  const normalized = legacyMethod.trim().toUpperCase();

  switch (normalized) {
    case 'WALLET':
      return CANONICAL_PAYMENT_METHODS.WALLET;

    case 'CASH':
    case 'PAY_AT_GATE':
    case 'PAY-AT-GATE':
      return CANONICAL_PAYMENT_METHODS.CASH;

    case 'CHEQUE':
    case 'CHQ':
    case 'DEMAND_DRAFT':
    case 'DD':
      return CANONICAL_PAYMENT_METHODS.CHEQUE;

    case 'BANK_TRANSFER':
    case 'BANK':
    case 'NEFT':
    case 'RTGS':
    case 'IMPS':
    case 'UPI':
    case 'NETBANKING':
    case 'OFFLINE_BANK_TRANSFER':
    case 'OFFLINE_NEFT':
      return CANONICAL_PAYMENT_METHODS.BANK_TRANSFER;

    case 'ONLINE':
    case 'RAZORPAY':
    case 'STRIPE':
    case 'CREDIT_CARD':
    case 'CARD':
    case 'MOCK':
    default:
      return CANONICAL_PAYMENT_METHODS.ONLINE;
  }
}

/**
 * Maps a Canonical Payment Method to a legacy format required by a specific target system.
 * @param {string} canonicalMethod
 * @param {string} [targetSystem='Payment'] - 'Payment', 'Invoice', 'AmenityBooking', 'Wallet'
 * @returns {string} Legacy Payment Method
 */
export function toLegacyPaymentMethod(canonicalMethod, targetSystem = 'Payment') {
  const method = (canonicalMethod || '').toUpperCase();

  switch (method) {
    case CANONICAL_PAYMENT_METHODS.WALLET:
      return 'WALLET';

    case CANONICAL_PAYMENT_METHODS.CASH:
      if (targetSystem === 'AmenityBooking') return 'PAY_AT_GATE';
      return 'CASH';

    case CANONICAL_PAYMENT_METHODS.CHEQUE:
      return 'CHEQUE';

    case CANONICAL_PAYMENT_METHODS.BANK_TRANSFER:
      return 'BANK_TRANSFER';

    case CANONICAL_PAYMENT_METHODS.ONLINE:
    default:
      if (targetSystem === 'Payment') return 'RAZORPAY';
      if (targetSystem === 'AmenityBooking') return 'RAZORPAY';
      return 'RAZORPAY';
  }
}

/**
 * Maps any legacy status from models (Payment, Invoice, AmenityBooking, WalletTransaction)
 * to the Canonical Financial Status.
 * @param {string} legacyStatus
 * @param {string} [domain='PAYMENT'] - Optional context domain
 * @returns {string} Canonical Payment Status
 */
export function toCanonicalPaymentStatus(legacyStatus, domain = 'PAYMENT') {
  if (!legacyStatus || typeof legacyStatus !== 'string') {
    return CANONICAL_PAYMENT_STATUSES.PENDING;
  }

  const normalized = legacyStatus.trim().toUpperCase();

  switch (normalized) {
    case 'CREATED':
    case 'INITIATED':
      return CANONICAL_PAYMENT_STATUSES.CREATED;

    case 'PENDING':
    case 'UNPAID':
    case 'VERIFICATION_PENDING':
    case 'PENDING_APPROVAL':
    case 'PENDING_L1':
    case 'PENDING_L2':
      return CANONICAL_PAYMENT_STATUSES.PENDING;

    case 'PROCESSING':
    case 'AUTHORIZED':
    case 'PARTIAL':
    case 'PARTIALLY_PAID':
      return CANONICAL_PAYMENT_STATUSES.PROCESSING;

    case 'SUCCESS':
    case 'PAID':
    case 'CAPTURED':
    case 'SETTLED':
    case 'CONFIRMED':
    case 'CHECKED-IN':
    case 'CHECKED_IN':
    case 'COMPLETED':
    case 'APPROVED':
      return CANONICAL_PAYMENT_STATUSES.SUCCESS;

    case 'FAILED':
    case 'REJECTED':
      return CANONICAL_PAYMENT_STATUSES.FAILED;

    case 'CANCELLED':
    case 'VOID':
      return CANONICAL_PAYMENT_STATUSES.CANCELLED;

    case 'REFUND_PENDING':
      return CANONICAL_PAYMENT_STATUSES.REFUND_PENDING;

    case 'PARTIALLY_REFUNDED':
    case 'PARTIAL_REFUND':
      return CANONICAL_PAYMENT_STATUSES.PARTIALLY_REFUNDED;

    case 'REFUNDED':
      return CANONICAL_PAYMENT_STATUSES.REFUNDED;

    default:
      return CANONICAL_PAYMENT_STATUSES.PENDING;
  }
}

/**
 * Maps a Canonical Status to the legacy status format expected by a specific target collection.
 * @param {string} canonicalStatus
 * @param {string} targetModel - 'Payment', 'Invoice', 'AmenityBooking', 'WalletTransaction'
 * @param {object} [options={}] - Options such as isOffline: boolean
 * @returns {string} Legacy Status string
 */
export function toLegacyPaymentStatus(canonicalStatus, targetModel = 'Payment', options = {}) {
  const status = (canonicalStatus || '').toUpperCase();
  const isOffline = Boolean(options.isOffline);

  switch (targetModel) {
    case 'Payment':
      switch (status) {
        case CANONICAL_PAYMENT_STATUSES.SUCCESS:
          return isOffline ? 'PAID' : 'success';
        case CANONICAL_PAYMENT_STATUSES.PENDING:
          return isOffline ? 'VERIFICATION_PENDING' : 'pending';
        case CANONICAL_PAYMENT_STATUSES.FAILED:
          return isOffline ? 'REJECTED' : 'failed';
        case CANONICAL_PAYMENT_STATUSES.PROCESSING:
          return 'processing';
        case CANONICAL_PAYMENT_STATUSES.REFUNDED:
          return 'refunded';
        case CANONICAL_PAYMENT_STATUSES.CANCELLED:
          return 'cancelled';
        default:
          return 'pending';
      }

    case 'Invoice':
      switch (status) {
        case CANONICAL_PAYMENT_STATUSES.SUCCESS:
          return 'PAID';
        case CANONICAL_PAYMENT_STATUSES.PROCESSING:
          return 'PARTIALLY_PAID';
        case CANONICAL_PAYMENT_STATUSES.PENDING:
          return isOffline ? 'VERIFICATION_PENDING' : 'UNPAID';
        case CANONICAL_PAYMENT_STATUSES.CANCELLED:
          return 'CANCELLED';
        case CANONICAL_PAYMENT_STATUSES.FAILED:
        default:
          return 'UNPAID';
      }

    case 'AmenityBooking':
      switch (status) {
        case CANONICAL_PAYMENT_STATUSES.SUCCESS:
          return 'success';
        case CANONICAL_PAYMENT_STATUSES.REFUNDED:
          return 'refunded';
        case CANONICAL_PAYMENT_STATUSES.PARTIALLY_REFUNDED:
          return 'partial_refund';
        case CANONICAL_PAYMENT_STATUSES.FAILED:
          return 'failed';
        case CANONICAL_PAYMENT_STATUSES.PENDING:
        default:
          return 'pending';
      }

    case 'WalletTransaction':
      switch (status) {
        case CANONICAL_PAYMENT_STATUSES.SUCCESS:
          return 'success';
        case CANONICAL_PAYMENT_STATUSES.REFUNDED:
          return 'refunded';
        case CANONICAL_PAYMENT_STATUSES.FAILED:
          return 'failed';
        case CANONICAL_PAYMENT_STATUSES.PENDING:
        default:
          return 'pending';
      }

    default:
      return status.toLowerCase();
  }
}

/**
 * Precision-safe conversion from Indian Rupees to Paise (integers).
 * Avoids IEEE 754 floating-point multiplication errors (e.g. 19.99 * 100 = 1998.9999999999998).
 * @param {number|string} rupees
 * @returns {number} Integer paise
 */
export function rupeesToPaise(rupees) {
  const num = Number(rupees);
  if (isNaN(num)) return 0;
  return Math.round(Math.round(num * 1000) / 10);
}

/**
 * Precision-safe conversion from Paise to Indian Rupees (2 decimal places).
 * @param {number|string} paise
 * @returns {number} Rupees in float
 */
export function paiseToRupees(paise) {
  const num = Number(paise);
  if (isNaN(num)) return 0;
  return Math.round(num) / 100;
}

/**
 * Standard Indian Rupee currency formatter.
 * @param {number|string} amount
 * @returns {string} Formatted string, e.g. "₹2,50,000.00"
 */
export function formatINR(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
