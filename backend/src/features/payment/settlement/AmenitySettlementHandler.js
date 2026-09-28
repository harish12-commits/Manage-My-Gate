import DomainSettlementInterface from './DomainSettlementInterface.js';
import logger from '../../../utils/logger.utils.js';

const V2_REFERENCE_TYPES = ['AmenityReservationHold', 'AmenityReservation'];

export class AmenitySettlementHandler extends DomainSettlementInterface {
  async settle(payment, session) {
    // V2 amenity reservations (Amenity Management) settle through their own service;
    // legacy AmenityBooking payments keep the original path below.
    if (V2_REFERENCE_TYPES.includes(payment.referenceType)) {
      const { amenityPaymentService } = await import('../../amenityManagement/payments/amenityPayment.service.js');
      if (payment.referenceType === 'AmenityReservationHold') {
        return amenityPaymentService.settleHoldPayment(payment, session);
      }
      const reservation = await amenityPaymentService.applySettledPayment(payment.referenceId, payment, session);
      return { status: 'APPLIED', reservationId: reservation?._id };
    }

    logger.info('Executing Amenity Booking settlement', {
      bookingId: payment.referenceId,
      paymentId: payment._id,
      amount: payment.amount,
    });

    const amenityBookingService = (await import('../../amenityBooking/amenityBooking.services.js')).default;

    const paymentData = {
      gatewayTransactionId: payment.gatewayTransactionId || payment.gatewayOrderId || String(payment._id),
      paymentMethod: payment.paymentMethod || 'RAZORPAY',
      amount: payment.amount,
      id: payment.gatewayTransactionId,
      paymentId: payment._id,
    };

    const updatedBooking = await amenityBookingService.settleBookingPayment(
      payment.referenceId,
      paymentData,
      session
    );

    return updatedBooking;
  }

  async refund(payment, refundRecord, session) {
    logger.info('Executing Amenity Booking refund settlement', {
      bookingId: payment.referenceId,
      refundId: refundRecord._id,
      amount: refundRecord.amount,
    });

    const AmenityBooking = (await import('../../amenityBooking/amenityBooking.model.js')).default;
    const query = AmenityBooking.findById(payment.referenceId);
    if (session) query.session(session);
    const booking = await query;

    if (!booking) {
      logger.warn(`AmenityBooking ${payment.referenceId} not found during refund settlement`);
      return null;
    }

    const isFullRefund = Math.abs(refundRecord.amount) >= (booking.pricing?.totalPrice || booking.totalPrice || booking.amount || 0);
    booking.paymentStatus = isFullRefund ? 'refunded' : 'partial_refund';
    if (isFullRefund) {
      booking.status = 'cancelled';
      booking.cancellationReason = 'Refunded via payment gateway';
    }

    await booking.save(session ? { session } : undefined);
    return booking;
  }
}

export default new AmenitySettlementHandler();
