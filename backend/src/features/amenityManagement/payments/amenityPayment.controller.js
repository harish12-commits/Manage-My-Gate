import amenityReservationService from '../reservations/amenityReservation.service.js';
import amenityPaymentService from './amenityPayment.service.js';
import HttpError from '../../../utils/httpError.utils.js';
import crypto from 'crypto';
import logger from '../../../utils/logger.utils.js';

export class AmenityPaymentController {
  /**
   * Creates (or safely resumes) the Razorpay order for an amenity booking: the amount
   * due now on a hold (`holdId`), or the outstanding balance of a booking
   * (`reservationId`). Amounts come from the server, never from the device.
   */
  async createOrder(req, res, next) {
    try {
      const orgId = req.tenant?.orgId;
      const userId = req.user?.id || req.user?._id;
      const { holdId, reservationId } = req.body;

      let reservation = null;
      if (!holdId) {
        reservation = await amenityReservationService.getReservationById(reservationId);
        if (!reservation || String(reservation.orgId) !== String(orgId)) {
          throw new HttpError(404, 'Reservation not found');
        }
        if (!(await amenityReservationService.canUserAccessReservation(req.user, reservation))) {
          throw new HttpError(403, 'Forbidden. You do not have permission to pay for this reservation.');
        }
      }

      const order = await amenityPaymentService.createGatewayOrder({ orgId, userId, holdId, reservation });
      if (order.alreadyVerified) {
        return res.success(order, 'Payment has already been verified.');
      }
      return res.success(order, 'Amenity payment order created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verifies Razorpay's signed response and settles it server-side: a hold payment
   * creates the booking, a balance payment completes it.
   */
  async verifyPayment(req, res, next) {
    try {
      const result = await amenityPaymentService.verifyGatewayPayment({
        orgId: req.tenant?.orgId,
        userId: req.user?.id || req.user?._id,
        ...req.body,
      });
      return res.success(result, 'Amenity payment verified successfully');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Processes payment webhook notification.
   */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

      // Gateway HMAC SHA256 signature verification when secret is configured
      if (secret) {
        if (!signature) {
          logger.warn('[AmenityPaymentController] Missing webhook signature header');
          return res.status(400).json({ success: false, message: 'Missing webhook signature' });
        }

        const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
        const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        let isValid = false;
        try {
          if (typeof signature === 'string' && signature.length === expectedSignature.length) {
            isValid = crypto.timingSafeEqual(
              Buffer.from(signature, 'utf8'),
              Buffer.from(expectedSignature, 'utf8')
            );
          }
        } catch {
          isValid = false;
        }

        if (!isValid) {
          logger.warn('[AmenityPaymentController] Webhook signature verification failed');
          return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
        }
      }

      const { orgId, holdId, reservationId, paymentReference, status, paymentAmount } = req.body;

      const result = await amenityReservationService.handlePaymentWebhook({
        orgId,
        holdId,
        reservationId,
        paymentReference,
        status,
        paymentAmount,
      });

      return res.status(200).json({
        success: true,
        message: 'Payment webhook processed successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const amenityPaymentController = new AmenityPaymentController();
export default amenityPaymentController;
