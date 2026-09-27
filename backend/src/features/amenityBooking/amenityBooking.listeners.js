import { amenityBookingEventEmitter, AMENITY_BOOKING_CREATED, AMENITY_BOOKING_CANCELLED, AMENITY_BOOKING_CHECKED_IN, AMENITY_BOOKING_COMPLETED, AMENITY_BOOKING_CONFIRMED } from './amenityBooking.events.js';
import { paymentEventEmitter, PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_REFUNDED } from '../payment/payment.events.js';
import amenityBookingRepository from './amenityBooking.repository.js';
import notificationService from '../notification/notification.service.js';
import logger from '../../utils/logger.utils.js';
import QRCode from 'qrcode';
import walletService from '../wallet/wallet.service.js';

const generateBookingId = () => `BKG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

const logBookingEvent = async (action, eventData) => {
  try {
    const targetId = eventData._id;
    const actorId = eventData.userId;
    logger.info(`Audit Log: ${action} logged for booking ${targetId} by user ${actorId}`);
  } catch (error) {
    logger.error(`Failed to write audit log for ${action} event: `, error);
  }
};

const sendBookingNotification = async (booking, type, title, message) => {
  try {
    await notificationService.createNotification({
      recipientId: booking.userId,
      orgId: booking.orgId || null,
      title: title,
      body: message,
      type: type === 'alert' ? 'WARNING' : type === 'info' ? 'INFO' : 'SUCCESS',
      actionUrl: `/resident/amenities/calendar`,
      senderId: null // System notification
    });
  } catch (error) {
    logger.error('Failed to send booking notification: ', error);
  }
};

// Listen to standard amenity booking events
amenityBookingEventEmitter.on(AMENITY_BOOKING_CREATED, async (booking) => {
  logBookingEvent('AMENITY_BOOKING_CREATED', booking);
  if (booking.status === 'confirmed') {
    try {
      const crypto = (await import('crypto')).default;
      const bookingIdStr = booking.bookingId || generateBookingId();
      const passToken = booking.passToken || crypto.randomBytes(32).toString('hex');
      const passTokenHash = booking.passTokenHash || crypto.createHash('sha256').update(passToken).digest('hex');
      const qrCodeUrl = await QRCode.toDataURL(`MMG:AMENITY:${passToken}`);
      const qrExpiresAt = new Date(`${booking.bookingDate}T${booking.endTime}`);
      
      await amenityBookingRepository.updateStatus(booking._id, booking.orgId, 'confirmed', { 
        bookingId: bookingIdStr,
        passToken,
        passTokenHash,
        qrCode: qrCodeUrl,
        qrStatus: 'active',
        qrGeneratedAt: new Date(),
        qrExpiresAt
      });
      
      const updatedBooking = await amenityBookingRepository.findById(booking._id, booking.orgId);
      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CONFIRMED, { booking: updatedBooking, paymentMethod: booking.paymentMethod || 'system' });
      
      await sendBookingNotification(booking, 'alert', 'Booking Confirmed', 'Your amenity booking is confirmed!');
    } catch (e) {
      logger.error('Failed to generate QR for auto-confirmed booking', e);
    }
  } else if (booking.paymentStatus === 'pending') {
    await sendBookingNotification(booking, 'info', 'Payment Required', 'Please complete the payment to confirm your booking.');
  } else {
    await sendBookingNotification(booking, 'info', 'Booking Created', 'Your booking is pending approval.');
  }

  try {
    const { getIO } = await import('../../config/socket.js');
    const io = getIO();
    if (io) {
      io.to(`org:${booking.orgId}`).emit('amenity_booking_created', booking);
    }
  } catch (e) {
    logger.error('Failed to emit socket event for booking creation', e);
  }
});



amenityBookingEventEmitter.on(AMENITY_BOOKING_CANCELLED, async (booking) => {
  logBookingEvent('AMENITY_BOOKING_CANCELLED', booking);
  
  let msg = 'Your booking has been cancelled successfully.';
  if (booking.refundPercentage === 100 && booking.refundAmount > 0) {
    msg = `Booking cancelled successfully. ₹${booking.refundAmount} has been credited to your wallet.`;
  } else if (booking.refundPercentage > 0 && booking.refundPercentage < 100 && booking.refundAmount > 0) {
    msg = `Booking cancelled successfully. ${booking.refundPercentage}% refund has been credited to your wallet.`;
  } else if (booking.refundAmount === 0 && booking.paymentStatus === 'success') {
    msg = 'Booking cancelled successfully. No refund is applicable because the cancellation occurred within the configured refund window.';
    // Update debit transaction
    try {
      await walletService.updateTransactionDescription(booking._id, 'Debit', '(Cancelled within the configured refund window. No refund issued.)');
    } catch (e) {
      logger.error('Failed to update debit transaction description', e);
    }
  }

  await sendBookingNotification(booking, booking.refundAmount === 0 && booking.paymentStatus === 'success' ? 'alert' : 'info', 'Booking Cancelled', msg);
  
  try {
    const { getIO } = await import('../../config/socket.js');
    const io = getIO();
    if (io) {
      io.to(`user:${booking.userId}`).emit('bookingUpdated');
      if (booking.refundAmount === 0 && booking.paymentStatus === 'success') {
        io.to(`user:${booking.userId}`).emit('walletUpdated');
      }
      io.to(`org:${booking.orgId}`).emit('amenity_booking_cancelled', booking);
    }
  } catch (e) {
    logger.error('Failed to emit socket event for booking cancellation', e);
  }
});

amenityBookingEventEmitter.on(AMENITY_BOOKING_CHECKED_IN, async (booking) => {
  logBookingEvent('AMENITY_BOOKING_CHECKED_IN', booking);
  try {
    const { getIO } = await import('../../config/socket.js');
    const io = getIO();
    if (io) {
      io.to(`org:${booking.orgId}`).emit('bookingUpdated');
      io.to(`user:${booking.userId._id || booking.userId}`).emit('bookingUpdated');
    }
  } catch (e) {
    logger.error('Failed to emit socket event for booking check-in', e);
  }
});

amenityBookingEventEmitter.on(AMENITY_BOOKING_COMPLETED, async (booking) => {
  logBookingEvent('AMENITY_BOOKING_COMPLETED', booking);
  try {
    const { getIO } = await import('../../config/socket.js');
    const io = getIO();
    if (io) {
      io.to(`org:${booking.orgId}`).emit('bookingUpdated');
      io.to(`org:${booking.orgId}`).emit('bookingCompleted');
      io.to(`user:${booking.userId._id || booking.userId}`).emit('bookingUpdated');
    }
  } catch (e) {
    logger.error('Failed to emit socket event for booking completed', e);
  }
});


// ---------------------------------------------------------
// Listen to Payment Events (The async payment flow)
// ---------------------------------------------------------

paymentEventEmitter.on(PAYMENT_SUCCESS, async (payment, options = {}) => {
  if (payment.referenceType !== 'AmenityBooking') return;

  try {
    const amenityBookingService = (await import('./amenityBooking.services.js')).default;
    
    // Call the service to update status only if not already settled in transaction
    let settledBooking = options.domainResult;
    if (!settledBooking && !options.alreadySettled) {
      settledBooking = await amenityBookingService.settleBookingPayment(payment.referenceId, payment, null);
    }

    const AmenityBooking = (await import('./amenityBooking.model.js')).default;
    const booking = await AmenityBooking.findById(payment.referenceId).populate(['amenityId', 'userId']);
    
    if (booking) {
      const { getIO } = await import('../../config/socket.js');
      const io = getIO();
      if (io) {
        const userIdStr = booking.userId?._id?.toString() || booking.userId?.toString();
        const orgIdStr = booking.orgId?.toString();
        io.to('user:' + userIdStr).to('org:' + orgIdStr).emit('AMENITY_BOOKING_CONFIRMED', booking);
        // Also emit wallet update in case they need to refresh their active passes
        io.to('user:' + userIdStr).emit('walletUpdated');
      }
      
      // Send Notification
      await sendBookingNotification(booking, 'alert', 'Payment Successful', 'Your booking is now confirmed. View your QR code in your Wallet.');
      logger.info(`Successfully processed payment and confirmed booking ${booking._id}`);
      
      // We must also trigger the AMENITY_BOOKING_CONFIRMED event internally so wallet transactions get created for successful gateway payments
      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CONFIRMED, { booking, paymentMethod: payment.paymentMethod || 'RAZORPAY', amount: payment.amount });
    }
  } catch (err) {
    logger.error('Failed to handle PAYMENT_SUCCESS for amenity booking', err);
  }
});

paymentEventEmitter.on(PAYMENT_FAILED, async (payment) => {
  if (payment.referenceType !== 'AmenityBooking') return;

  try {
    const booking = await amenityBookingRepository.findById(payment.referenceId, payment.orgId);
    if (booking) {
      await amenityBookingRepository.updateStatus(booking._id, booking.orgId, 'cancelled', {
        paymentStatus: 'failed'
      });
      await sendBookingNotification(booking, 'alert', 'Payment Failed', 'Your booking was cancelled because the payment failed.');
      logger.info(`Cancelled booking ${booking._id} due to payment failure`);
    }
  } catch (err) {
    logger.error('Failed to handle PAYMENT_FAILED for amenity booking', err);
  }
});

// Payload is the refund Payment record. Wallet crediting for WALLET-paid bookings is owned by the wallet
// service (unified wallet + ledger); gateway refunds go back to the card, so the wallet is not touched here.
paymentEventEmitter.on(PAYMENT_REFUNDED, async (refundRecord) => {
  if (refundRecord.referenceType !== 'AmenityBooking') return;

  try {
    const booking = await amenityBookingRepository.findById(refundRecord.referenceId, refundRecord.orgId);
    if (booking) {
      await sendBookingNotification(booking, 'info', 'Refund Processed', 'Your refund for the cancelled booking has been processed.');
    }
  } catch (err) {
    logger.error('Failed to handle PAYMENT_REFUNDED for amenity booking', err);
  }
});
