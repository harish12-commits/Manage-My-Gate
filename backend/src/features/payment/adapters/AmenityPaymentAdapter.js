import PaymentContextFactory from '../paymentContext.factory.js';
import {
  toLegacyPaymentStatus,
  toLegacyPaymentMethod,
  toCanonicalPaymentStatus,
  toCanonicalPaymentMethod,
  PAYMENT_DOMAINS,
  PAYMENT_REFERENCE_TYPES,
} from '../payment.constants.js';

/**
 * AmenityPaymentAdapter
 * Bridge adapter between the Amenity Booking feature and the unified payment layer.
 */
export class AmenityPaymentAdapter {
  /**
   * Create a canonical PaymentContext from an AmenityBooking.
   * @param {object} booking
   * @param {object} [options={}]
   * @returns {import('../payment.types.js').PaymentContext}
   */
  createPaymentContext(booking, options = {}) {
    return PaymentContextFactory.fromAmenityBooking(booking, options);
  }

  /**
   * Format payment initialization arguments suitable for payment order creation.
   * @param {import('../payment.types.js').PaymentContext} paymentContext
   * @param {object} [options={}]
   * @returns {object}
   */
  formatPaymentCreationParams(paymentContext, options = {}) {
    return {
      orgId: paymentContext.orgId,
      userId: paymentContext.userId,
      referenceId: paymentContext.referenceId,
      referenceType: paymentContext.referenceType || PAYMENT_REFERENCE_TYPES.AMENITY_BOOKING,
      amount: paymentContext.amount,
      currency: paymentContext.currency,
      gateway: options.gateway || 'razorpay',
    };
  }

  /**
   * Format booking payment status update payload.
   * @param {import('../payment.types.js').PaymentContext} paymentContext
   * @param {object} paymentResult - Payment record or verification result
   * @returns {object}
   */
  formatBookingPaymentUpdate(paymentContext, paymentResult = {}) {
    const rawStatus = paymentResult.status || 'SUCCESS';
    const legacyStatus = toLegacyPaymentStatus(rawStatus, 'AmenityBooking');
    const legacyMethod = toLegacyPaymentMethod(paymentContext.paymentMethod, 'AmenityBooking');
    const transactionId = paymentResult.gatewayTransactionId || paymentResult.orderId || null;
    const amount = paymentResult.amount !== undefined ? Number(paymentResult.amount) : paymentContext.amount;

    return {
      bookingId: paymentContext.referenceId,
      paymentStatus: legacyStatus,
      paymentMethod: legacyMethod,
      transactionId,
      amount,
      paidAt: legacyStatus === 'success' ? new Date() : null,
      metadata: {
        paymentId: paymentResult._id || paymentResult.paymentId || null,
        idempotencyKey: paymentContext.idempotencyKey,
      },
    };
  }

  /**
   * Convert canonical status to Amenity legacy status.
   * @param {string} canonicalStatus
   * @returns {string}
   */
  toLegacyStatus(canonicalStatus) {
    return toLegacyPaymentStatus(canonicalStatus, 'AmenityBooking');
  }

  /**
   * Convert canonical method to Amenity legacy method (e.g. CASH -> 'PAY_AT_GATE').
   * @param {string} canonicalMethod
   * @returns {string}
   */
  toLegacyMethod(canonicalMethod) {
    return toLegacyPaymentMethod(canonicalMethod, 'AmenityBooking');
  }

  /**
   * Convert Amenity status to canonical status.
   * @param {string} amenityStatus
   * @returns {string}
   */
  toCanonicalStatus(amenityStatus) {
    return toCanonicalPaymentStatus(amenityStatus, PAYMENT_DOMAINS.AMENITY);
  }

  /**
   * Convert Amenity method to canonical method.
   * @param {string} amenityMethod
   * @returns {string}
   */
  toCanonicalMethod(amenityMethod) {
    return toCanonicalPaymentMethod(amenityMethod);
  }
}

export const amenityPaymentAdapter = new AmenityPaymentAdapter();
export default amenityPaymentAdapter;
