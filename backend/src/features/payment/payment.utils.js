import { PAYMENT_DOMAINS } from './payment.constants.js';
import HttpError from '../../utils/httpError.utils.js';

/**
 * Authoritatively resolve the canonical payment domain from a Payment document or context.
 * Strict resolution: prefers payment.domain, then maps authoritative referenceType.
 * Fails safely if unrecognized.
 * @param {object} payment
 * @returns {string} Canonical domain (INVOICE, AMENITY, WALLET)
 */
export function resolvePaymentDomain(payment) {
  if (!payment || typeof payment !== 'object') {
    throw new HttpError(400, 'Payment object is required to resolve domain');
  }

  // 1. Explicit domain attribute
  const domain = (payment.domain || '').toUpperCase();
  if (domain && Object.values(PAYMENT_DOMAINS).includes(domain)) {
    return domain;
  }

  // 2. Authoritative referenceType mapping
  const refType = (payment.referenceType || '').trim();
  switch (refType) {
    case 'Invoice':
    case 'MaintenanceFee':
      return PAYMENT_DOMAINS.INVOICE;

    case 'AmenityBooking':
      return PAYMENT_DOMAINS.AMENITY;

    case 'WalletRecharge':
    case 'Wallet':
      return PAYMENT_DOMAINS.WALLET;

    default:
      throw new HttpError(400, `Unknown or unsupported payment domain for referenceType '${refType}'.`);
  }
}

/**
 * Validate that the requested payment amount matches the authoritative domain entity.
 * Protects against frontend amount tampering.
 * @param {string} domain - PAYMENT_DOMAINS
 * @param {string} referenceId - Entity ID
 * @param {number|string} requestedAmount - Requested amount in Rupees
 * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session
 * @returns {Promise<{ isValid: boolean, payableAmount: number, entity?: object }>}
 */
export async function validateAuthoritativeAmount(domain, referenceId, requestedAmount, session = null, options = {}) {
  const amount = Number(requestedAmount);
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    throw new HttpError(400, 'Payment amount must be a positive finite number.');
  }

  if (domain === PAYMENT_DOMAINS.INVOICE) {
    const Invoice = (await import('../invoice/invoice.model.js')).default;
    const query = Invoice.findById(referenceId);
    if (session) query.session(session);
    const invoice = await query;

    if (!invoice) {
      throw new HttpError(404, 'Referenced invoice not found.');
    }

    // Tenant Isolation Assertion
    const invoiceOrgId = (invoice.orgId || invoice.communityId)?.toString();
    if (options.orgId && invoiceOrgId && invoiceOrgId !== String(options.orgId)) {
      throw new HttpError(403, 'Cross-tenant payment forbidden: invoice belongs to a different community.');
    }

    if (invoice.status === 'PAID') {
      throw new HttpError(400, 'Invoice has already been fully settled.');
    }
    if (invoice.status === 'CANCELLED') {
      throw new HttpError(400, 'Invoice is cancelled and cannot accept payments.');
    }

    const totalDue = Number(invoice.totalDue !== undefined ? invoice.totalDue : invoice.totalAmount) || 0;
    const paidAmount = Number(invoice.paidAmount) || 0;
    const remainingDue = Math.max(0, totalDue - paidAmount);

    if (amount > remainingDue + 0.01) {
      throw new HttpError(400, `Payment amount (₹${amount}) exceeds remaining invoice due of ₹${remainingDue}.`);
    }

    return { isValid: true, payableAmount: remainingDue, entity: invoice };
  }

  if (domain === PAYMENT_DOMAINS.AMENITY) {
    const AmenityBooking = (await import('../amenityBooking/amenityBooking.model.js')).default;
    const query = AmenityBooking.findById(referenceId);
    if (session) query.session(session);
    const booking = await query;

    if (!booking) {
      throw new HttpError(404, 'Referenced amenity booking not found.');
    }

    // Tenant Isolation Assertion
    const bookingOrgId = (booking.orgId || booking.communityId)?.toString();
    if (options.orgId && bookingOrgId && bookingOrgId !== String(options.orgId)) {
      throw new HttpError(403, 'Cross-tenant payment forbidden: amenity booking belongs to a different community.');
    }

    if (['cancelled', 'rejected'].includes(booking.status)) {
      throw new HttpError(400, 'Amenity booking is cancelled or rejected and cannot accept payments.');
    }

    if (booking.paymentStatus === 'success') {
      throw new HttpError(400, 'Amenity booking has already been paid.');
    }

    const totalExpected = Number(
      booking.pricingDetails?.totalAmount !== undefined
        ? booking.pricingDetails.totalAmount
        : booking.pricing?.totalPrice !== undefined
        ? booking.pricing.totalPrice
        : booking.totalPrice !== undefined
        ? booking.totalPrice
        : booking.amount
    ) || 0;

    if (Math.abs(amount - totalExpected) > 0.01) {
      throw new HttpError(
        400,
        `Requested payment amount (₹${amount}) does not match required booking total of ₹${totalExpected}.`
      );
    }

    return { isValid: true, payableAmount: totalExpected, entity: booking };
  }

  if (domain === PAYMENT_DOMAINS.WALLET) {
    if (amount < 1) {
      throw new HttpError(400, 'Minimum wallet recharge amount is ₹1.');
    }
    return { isValid: true, payableAmount: amount };
  }

  return { isValid: true, payableAmount: amount };
}

export default {
  resolvePaymentDomain,
  validateAuthoritativeAmount,
};
