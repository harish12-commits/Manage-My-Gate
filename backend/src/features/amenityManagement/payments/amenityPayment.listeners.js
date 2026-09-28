import { paymentEventEmitter, PAYMENT_SUCCESS } from '../../payment/payment.events.js';
import logger from '../../../utils/logger.utils.js';

/**
 * A gateway payment for a hold that could no longer be booked (the hold expired and
 * its time was taken before the capture arrived) is settled as UNFULFILLED. The resident
 * received nothing, so the money goes back to the card/UPI it came from rather than
 * to the wallet. Runs after the settlement transaction has committed.
 */
paymentEventEmitter.on(PAYMENT_SUCCESS, async (payment, options = {}) => {
  if (payment?.referenceType !== 'AmenityReservationHold') return;
  if (options?.domainResult?.status !== 'UNFULFILLED') return;

  try {
    const unifiedPaymentService = (await import('../../payment/unifiedPayment.service.js')).default;
    await unifiedPaymentService.processRefund({
      paymentId: payment._id,
      amount: payment.amount,
      notes: { reason: options.domainResult.reason || 'Amenity booking could not be completed' },
    });
    logger.info('[AmenityPayment] Refunded unfulfilled amenity payment to source', {
      paymentId: payment._id,
      amount: payment.amount,
    });
  } catch (err) {
    logger.error('[AmenityPayment] Failed to refund unfulfilled amenity payment', {
      paymentId: payment._id,
      error: err.message,
    });
  }
});
