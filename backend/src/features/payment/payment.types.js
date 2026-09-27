import crypto from 'crypto';
import HttpError from '../../utils/httpError.utils.js';
import {
  PAYMENT_DOMAINS,
  CANONICAL_PAYMENT_METHODS,
  PAYMENT_REFERENCE_TYPES,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
} from './payment.constants.js';

/**
 * Generate a deterministic or pseudo-unique idempotency key.
 * @param {string} domain - Domain name (INVOICE, AMENITY, WALLET)
 * @param {string} referenceId - Entity ID
 * @param {string} [method='ONLINE'] - Payment method
 * @param {string} [salt=''] - Optional salt (e.g. timestamp or attempt count)
 * @returns {string} Idempotency key
 */
export function generateIdempotencyKey(domain, referenceId, method = 'ONLINE', salt = '') {
  const seed = `${domain || 'PAYMENT'}:${referenceId || 'GEN'}:${method || 'ONLINE'}:${salt || Date.now()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 24);
  return `idemp_${(domain || 'pay').toLowerCase()}_${hash}`;
}

/**
 * Canonical Payment Context
 * Encapsulates the immutable contract required to initiate, track, and reconcile any financial transaction
 * across Billing, Amenities, and Wallet modules.
 */
export class PaymentContext {
  /**
   * @param {object} params
   * @param {string} params.domain - One of PAYMENT_DOMAINS ('INVOICE', 'AMENITY', 'WALLET')
   * @param {string|object} params.referenceId - ID of entity being paid (Invoice ID, Booking ID, Wallet ID)
   * @param {string} params.referenceType - Target model reference ('Invoice', 'AmenityBooking', 'WalletRecharge', etc.)
   * @param {string|object} params.orgId - Organization / Community identifier
   * @param {string|object} params.userId - User / Resident identifier
   * @param {string|object} [params.payerUserId] - Optional payer ID (defaults to userId)
   * @param {number} params.amount - Transaction amount in standard currency units (Rupees), > 0
   * @param {string} [params.currency='INR'] - 3-letter currency code
   * @param {string} [params.paymentMethod='ONLINE'] - One of CANONICAL_PAYMENT_METHODS
   * @param {string} [params.idempotencyKey] - Optional unique key (generated if omitted)
   * @param {object} [params.metadata={}] - Domain-specific key-value metadata
   * @param {Date|string} [params.createdAt] - Creation timestamp
   */
  constructor({
    domain,
    referenceId,
    referenceType,
    orgId,
    userId,
    payerUserId,
    amount,
    currency = DEFAULT_CURRENCY,
    paymentMethod = CANONICAL_PAYMENT_METHODS.ONLINE,
    idempotencyKey,
    metadata = {},
    createdAt = new Date(),
  }) {
    this.domain = domain;
    this.referenceId = referenceId ? String(referenceId) : null;
    this.referenceType = referenceType;
    this.orgId = orgId ? String(orgId) : null;
    this.userId = userId ? String(userId) : null;
    this.payerUserId = payerUserId ? String(payerUserId) : this.userId;
    this.amount = Number(amount);
    this.currency = (currency || DEFAULT_CURRENCY).toUpperCase();
    this.paymentMethod = paymentMethod;
    this.idempotencyKey = idempotencyKey || generateIdempotencyKey(this.domain, this.referenceId, this.paymentMethod);
    this.metadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);

    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  /**
   * Return a plain JSON object representation of the context.
   */
  toJSON() {
    return {
      domain: this.domain,
      referenceId: this.referenceId,
      referenceType: this.referenceType,
      orgId: this.orgId,
      userId: this.userId,
      payerUserId: this.payerUserId,
      amount: this.amount,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      idempotencyKey: this.idempotencyKey,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

/**
 * Validate that a PaymentContext satisfies all canonical financial boundaries.
 * @param {PaymentContext|object} context - PaymentContext instance or plain object
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validatePaymentContext(context) {
  const errors = [];

  if (!context || typeof context !== 'object') {
    return { isValid: false, errors: ['PaymentContext must be an object'] };
  }

  // 1. Domain
  const validDomains = Object.values(PAYMENT_DOMAINS);
  if (!context.domain || !validDomains.includes(context.domain)) {
    errors.push(`Invalid domain '${context.domain}'. Expected one of: ${validDomains.join(', ')}`);
  }

  // 2. Reference ID & Type
  if (!context.referenceId || typeof context.referenceId !== 'string' || context.referenceId.trim() === '') {
    errors.push('referenceId is required and must be a non-empty string');
  }

  const validReferenceTypes = Object.values(PAYMENT_REFERENCE_TYPES);
  if (!context.referenceType || (!validReferenceTypes.includes(context.referenceType) && typeof context.referenceType !== 'string')) {
    errors.push(`Invalid referenceType '${context.referenceType}'.`);
  }

  // 3. Organization ID
  if (!context.orgId || typeof context.orgId !== 'string' || context.orgId.trim() === '') {
    errors.push('orgId is required and must be a non-empty string');
  }

  // 4. User ID
  if (!context.userId || typeof context.userId !== 'string' || context.userId.trim() === '') {
    errors.push('userId is required and must be a non-empty string');
  }

  // 5. Amount
  if (typeof context.amount !== 'number' || !Number.isFinite(context.amount) || context.amount <= 0) {
    errors.push(`amount must be a positive finite number greater than 0. Received: ${context.amount}`);
  }

  // 6. Currency
  if (!context.currency || !SUPPORTED_CURRENCIES.includes(context.currency.toUpperCase())) {
    errors.push(`Unsupported currency '${context.currency}'. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }

  // 7. Payment Method
  const validMethods = Object.values(CANONICAL_PAYMENT_METHODS);
  if (!context.paymentMethod || !validMethods.includes(context.paymentMethod)) {
    errors.push(`Invalid paymentMethod '${context.paymentMethod}'. Expected one of: ${validMethods.join(', ')}`);
  }

  // 8. Idempotency Key
  if (context.idempotencyKey && (typeof context.idempotencyKey !== 'string' || context.idempotencyKey.trim() === '')) {
    errors.push('idempotencyKey, if provided, must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Assert that a PaymentContext is valid, throwing HttpError(400) if validation fails.
 * @param {PaymentContext|object} context
 * @throws {HttpError}
 */
export function assertValidPaymentContext(context) {
  const { isValid, errors } = validatePaymentContext(context);
  if (!isValid) {
    throw new HttpError(400, `Payment context validation failed: ${errors.join('; ')}`);
  }
}

export default {
  PaymentContext,
  validatePaymentContext,
  assertValidPaymentContext,
  generateIdempotencyKey,
};
