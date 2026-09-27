import { PaymentContext, assertValidPaymentContext } from './payment.types.js';
import {
  PAYMENT_DOMAINS,
  PAYMENT_REFERENCE_TYPES,
  DEFAULT_CURRENCY,
  toCanonicalPaymentMethod,
} from './payment.constants.js';
import HttpError from '../../utils/httpError.utils.js';

/**
 * PaymentContextFactory
 * Provides unified builders to generate standardized, strongly-validated PaymentContext
 * instances from various domain entities (Invoice, AmenityBooking, WalletRecharge).
 */
export class PaymentContextFactory {
  /**
   * Build a PaymentContext from an Invoice document or entity.
   * @param {object} invoice - Invoice entity / plain object
   * @param {object} [options={}] - Override options
   * @param {number} [options.amount] - Custom payment amount (defaults to outstanding due)
   * @param {string} [options.paymentMethod='ONLINE'] - Payment method
   * @param {string} [options.userId] - Override user ID
   * @param {string} [options.payerUserId] - Payer user ID
   * @param {object} [options.metadata] - Extra metadata
   * @param {boolean} [options.validate=true] - Whether to enforce validation
   * @returns {PaymentContext}
   */
  static fromInvoice(invoice, options = {}) {
    if (!invoice || typeof invoice !== 'object') {
      throw new HttpError(400, 'Invoice object is required to construct PaymentContext.');
    }

    const invoiceId = invoice._id || invoice.id;
    if (!invoiceId) {
      throw new HttpError(400, 'Invoice must have a valid _id or id.');
    }

    const rawOrg = options.orgId || invoice.orgId || invoice.communityId;
    const orgId = rawOrg?._id || rawOrg;
    if (!orgId) {
      throw new HttpError(400, 'Invoice must have an orgId or communityId.');
    }

    const rawUser = options.userId || invoice.residentId || invoice.userId || invoice.targetUserId;
    const userId = rawUser?._id || rawUser;
    if (!userId) {
      throw new HttpError(400, 'Invoice must have a residentId, userId, targetUserId, or options.userId.');
    }

    // Default amount to remaining due
    let amount = options.amount;
    if (amount === undefined || amount === null) {
      const totalDue = Number(invoice.totalDue !== undefined ? invoice.totalDue : invoice.totalAmount) || 0;
      const paidAmount = Number(invoice.paidAmount) || 0;
      amount = Math.max(0, totalDue - paidAmount);
    } else {
      amount = Number(amount);
    }

    const metadata = {
      invoiceNumber: invoice.invoiceNumber,
      unitNumber: invoice.unitNumber,
      totalDue: invoice.totalDue,
      paidAmount: invoice.paidAmount,
      invoiceType: invoice.invoiceType,
      ...(options.metadata || {}),
    };

    const context = new PaymentContext({
      domain: PAYMENT_DOMAINS.INVOICE,
      referenceId: String(invoiceId),
      referenceType: PAYMENT_REFERENCE_TYPES.INVOICE,
      orgId: String(orgId),
      userId: String(userId),
      payerUserId: options.payerUserId ? String(options.payerUserId) : String(userId),
      amount,
      currency: invoice.currency || DEFAULT_CURRENCY,
      paymentMethod: toCanonicalPaymentMethod(options.paymentMethod || 'ONLINE'),
      idempotencyKey: options.idempotencyKey,
      metadata,
    });

    if (options.validate !== false) {
      assertValidPaymentContext(context);
    }

    return context;
  }

  /**
   * Build a PaymentContext from an AmenityBooking document or entity.
   * @param {object} booking - AmenityBooking entity / plain object
   * @param {object} [options={}] - Override options
   * @param {number} [options.amount] - Custom payment amount (defaults to booking totalPrice)
   * @param {string} [options.paymentMethod] - Payment method
   * @param {string} [options.payerUserId] - Payer user ID
   * @param {object} [options.metadata] - Extra metadata
   * @param {boolean} [options.validate=true] - Whether to enforce validation
   * @returns {PaymentContext}
   */
  static fromAmenityBooking(booking, options = {}) {
    if (!booking || typeof booking !== 'object') {
      throw new HttpError(400, 'AmenityBooking object is required to construct PaymentContext.');
    }

    const bookingId = booking._id || booking.id;
    if (!bookingId) {
      throw new HttpError(400, 'AmenityBooking must have a valid _id or id.');
    }

    const rawOrg = options.orgId || booking.orgId;
    const orgId = rawOrg?._id || rawOrg;
    if (!orgId) {
      throw new HttpError(400, 'AmenityBooking must have an orgId.');
    }

    const rawUser = options.userId || booking.userId;
    const userId = rawUser?._id || rawUser;
    if (!userId) {
      throw new HttpError(400, 'AmenityBooking must have a userId.');
    }

    // Determine amount from booking pricing structure
    let amount = options.amount;
    if (amount === undefined || amount === null) {
      amount = Number(
        booking.pricingDetails?.totalAmount !== undefined
          ? booking.pricingDetails.totalAmount
          : booking.pricing?.totalPrice !== undefined
          ? booking.pricing.totalPrice
          : booking.totalPrice !== undefined
          ? booking.totalPrice
          : booking.amount
      ) || 0;
    } else {
      amount = Number(amount);
    }

    const paymentMethodRaw = options.paymentMethod || booking.paymentMethod || 'ONLINE';

    const metadata = {
      bookingNumber: booking.bookingNumber,
      amenityId: booking.amenityId ? String(booking.amenityId) : undefined,
      amenityName: booking.amenityName,
      slotId: booking.slotId ? String(booking.slotId) : undefined,
      startTime: booking.startTime,
      endTime: booking.endTime,
      ...(options.metadata || {}),
    };

    const context = new PaymentContext({
      domain: PAYMENT_DOMAINS.AMENITY,
      referenceId: String(bookingId),
      referenceType: PAYMENT_REFERENCE_TYPES.AMENITY_BOOKING,
      orgId: String(orgId),
      userId: String(userId),
      payerUserId: options.payerUserId ? String(options.payerUserId) : String(userId),
      amount,
      currency: booking.currency || DEFAULT_CURRENCY,
      paymentMethod: toCanonicalPaymentMethod(paymentMethodRaw),
      idempotencyKey: options.idempotencyKey,
      metadata,
    });

    if (options.validate !== false) {
      assertValidPaymentContext(context);
    }

    return context;
  }

  /**
   * Build a PaymentContext for a Wallet Recharge.
   * @param {object} params
   * @param {string|object} params.orgId - Organization ID
   * @param {string|object} params.userId - User ID
   * @param {number} params.amount - Recharge amount in Rupees
   * @param {string} [params.paymentMethod='ONLINE'] - Payment method
   * @param {string|object} [params.referenceId] - Wallet ID or generated reference
   * @param {object} [params.metadata={}] - Extra metadata
   * @param {object} [options={}] - Factory options (validate: boolean)
   * @returns {PaymentContext}
   */
  static fromWalletRecharge(
    { orgId: rawOrgId, userId: rawUserId, amount, paymentMethod = 'ONLINE', referenceId = null, metadata = {} },
    options = {}
  ) {
    const orgId = rawOrgId?._id || rawOrgId;
    const userId = rawUserId?._id || rawUserId;
    if (!orgId) throw new HttpError(400, 'orgId is required for Wallet Recharge.');
    if (!userId) throw new HttpError(400, 'userId is required for Wallet Recharge.');
    if (amount === undefined || amount === null) {
      throw new HttpError(400, 'amount is required for Wallet Recharge.');
    }

    const refId = referenceId || metadata.walletId || `wrc_${userId}_${Date.now()}`;

    const context = new PaymentContext({
      domain: PAYMENT_DOMAINS.WALLET,
      referenceId: String(refId),
      referenceType: PAYMENT_REFERENCE_TYPES.WALLET_RECHARGE,
      orgId: String(orgId),
      userId: String(userId),
      payerUserId: String(userId),
      amount: Number(amount),
      currency: DEFAULT_CURRENCY,
      paymentMethod: toCanonicalPaymentMethod(paymentMethod),
      idempotencyKey: options.idempotencyKey,
      metadata: {
        walletId: metadata.walletId ? String(metadata.walletId) : undefined,
        rechargeType: 'TOPUP',
        ...metadata,
      },
    });

    if (options.validate !== false) {
      assertValidPaymentContext(context);
    }

    return context;
  }

  /**
   * Alias for fromInvoice.
   */
  static forInvoice(invoice, options = {}) {
    return this.fromInvoice(invoice, options);
  }

  /**
   * Alias for fromWalletRecharge.
   */
  static forWalletRecharge(params, options = {}) {
    return this.fromWalletRecharge(params, options);
  }
}

export default PaymentContextFactory;
