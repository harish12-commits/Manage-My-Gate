import { paymentEventEmitter, PAYMENT_SUCCESS } from '../../payment/payment.events.js';
import logger from '../../../utils/logger.utils.js';
import AmenityReservation from '../reservations/amenityReservation.model.js';
import amenityManagementEvents, { AMENITY_EVENTS } from '../amenityManagement.events.js';

/**
 * A balance paid online on an existing booking changes what the resident sees on My
 * Bookings; push the settled booking to their devices. Gateway settlements commit their
 * own transaction before this fires. Wallet and cash payments settle inside the amenity
 * transaction, so the reservation service publishes those after its commit instead.
 */
paymentEventEmitter.on(PAYMENT_SUCCESS, async (payment) => {
  if (payment?.referenceType !== 'AmenityReservation' || !payment.referenceId) return;
  if (payment.gateway !== 'razorpay') return;
  try {
    const reservation = await AmenityReservation.findById(payment.referenceId).lean();
    if (reservation) amenityManagementEvents.emit(AMENITY_EVENTS.RESERVATION_UPDATED, reservation);
  } catch (err) {
    logger.warn('[AmenityPayment] Could not publish the updated booking', { paymentId: payment._id, error: err.message });
  }
});

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
