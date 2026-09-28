import amenityReservationService from '../reservations/amenityReservation.service.js';
import amenityReservationHoldRepository from '../holds/amenityReservationHold.repository.js';
import amenityFacilityRepository from '../facilities/amenityFacility.repository.js';
import pricingService from '../domain/pricing/pricing.service.js';
import paymentService from '../../payment/payment.service.js';
import Payment from '../../payment/payment.model.js';
import HttpError from '../../../utils/httpError.utils.js';
import crypto from 'crypto';
import logger from '../../../utils/logger.utils.js';

export class AmenityPaymentController {
  /**
   * Creates (or safely resumes) the one Razorpay order associated with an
   * active amenity hold. Amount and merchant credentials come from the
   * community's Integration Hub, never from the device.
   */
  async createOrder(req, res, next) {
    try {
      const orgId = req.tenant?.orgId;
      const residentId = req.user?.id || req.user?._id;
      const { holdId } = req.body;

      const hold = await amenityReservationHoldRepository.findActiveById(holdId);
      if (!hold || String(hold.orgId) !== String(orgId) || String(hold.residentId) !== String(residentId)) {
        throw new HttpError(404, 'Active reservation hold not found');
      }

      const facility = await amenityFacilityRepository.findById(hold.facilityId, orgId);
      if (!facility) {
        throw new HttpError(404, 'Amenity facility not found');
      }

      // The hold carries the price the resident was quoted when the slot was held.
      const pricingSnapshot =
        hold.pricingSnapshot?.totalAmount !== undefined && hold.pricingSnapshot !== null
          ? hold.pricingSnapshot
          : pricingService.calculateForFacility(facility, {
              startDateTime: hold.requestedStartDateTime,
              endDateTime: hold.requestedEndDateTime,
              headcount: hold.headcount,
              quantity: hold.quantity,
            });
      const amount = Number(pricingSnapshot.totalAmount || 0);
      if (amount <= 0) {
        throw new HttpError(400, 'This reservation does not require an online payment');
      }

      const existingPayment = await Payment.findOne({
        orgId,
        userId: residentId,
        referenceId: hold._id,
        referenceType: 'AmenityReservationHold',
        status: { $in: ['pending', 'success'] },
      }).sort({ createdAt: -1 });

      if (existingPayment?.status === 'success') {
        return res.success(
          { paymentId: existingPayment._id, alreadyVerified: true },
          'Payment has already been verified. Confirm the reservation to finish booking.'
        );
      }

      const paymentOrder = existingPayment
        ? await paymentService.getCheckoutDetails(existingPayment)
        : await paymentService.createPaymentOrder({
            orgId,
            userId: residentId,
            referenceId: hold._id,
            referenceType: 'AmenityReservationHold',
            amount,
            currency: pricingSnapshot.currency || 'INR',
            gateway: 'razorpay',
          });

      return res.success(paymentOrder, 'Amenity payment order created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verifies Razorpay's signed response before a paid reservation can be
   * promoted. A raw Razorpay payment ID from the browser is not trusted.
   */
  async verifyPayment(req, res, next) {
    try {
      const orgId = req.tenant?.orgId;
      const residentId = req.user?.id || req.user?._id;
      const { paymentId, orderId, razorpayPaymentId, razorpaySignature } = req.body;

      const payment = await paymentService.assertPaymentAccess(paymentId, {
        orgId,
        userId: residentId,
      });
      if (payment.referenceType !== 'AmenityReservationHold' || payment.gateway !== 'razorpay') {
        throw new HttpError(400, 'Payment is not an amenity Razorpay payment');
      }

      const result = await paymentService.verifyPaymentSignature({
        orgId,
        paymentId,
        orderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      const verifiedPayment = result.payment?.toObject ? result.payment.toObject() : result.payment;

      return res.success(
        { payment: verifiedPayment, paymentId: verifiedPayment?._id },
        'Amenity payment verified successfully'
      );
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
