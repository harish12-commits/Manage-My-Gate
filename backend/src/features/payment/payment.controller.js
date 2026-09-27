import paymentService from './payment.service.js';
import HttpError from '../../utils/httpError.utils.js';
import { checkIsAdmin } from '../../middlewares/rbac.middleware.js';
import config from '../../config/config.js';

const getRequestActor = (req) => ({
  orgId: req.tenant?.orgId,
  userId: req.user?.id || req.user?._id,
});

class PaymentController {
  /**
   * Create Payment Order
   */
  async createOrder(req, res, next) {
    try {
      const { referenceId, referenceType, amount, currency, gateway } = req.body;
      const idempotencyKey = req.get('Idempotency-Key') || req.body.idempotencyKey || null;
      const { orgId, userId } = getRequestActor(req);

      if (!orgId || !userId) {
        throw new HttpError(400, 'Organization ID and User ID are required.');
      }

      const orderResult = await paymentService.createPaymentOrder({
        orgId,
        userId,
        referenceId,
        referenceType,
        amount,
        currency,
        gateway,
        idempotencyKey,
      });

      res.status(201).json({
        success: true,
        message: 'Payment order created successfully',
        data: orderResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify Payment Signature
   */
  async verifySignature(req, res, next) {
    try {
      const { paymentId, orderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (!paymentId) {
        throw new HttpError(400, 'paymentId is required for payment verification.');
      }
      const { orgId, userId } = getRequestActor(req);
      const isAdmin = await checkIsAdmin(req);

      await paymentService.assertPaymentAccess(paymentId, { orgId, userId, isAdmin });

      const verificationResult = await paymentService.verifyPaymentSignature({
        orgId,
        paymentId,
        orderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      const paymentObj = verificationResult.payment?.toObject ? verificationResult.payment.toObject() : verificationResult.payment;

      res.status(200).json({
        success: true,
        message: verificationResult.message,
        data: {
          ...paymentObj,
          payment: paymentObj,
          invoice: verificationResult.invoice,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process Refund
   */
  async refund(req, res, next) {
    try {
      const { paymentId, amount, notes } = req.body;
      if (!paymentId) {
        throw new HttpError(400, 'paymentId is required for refund.');
      }

      const { orgId, userId } = getRequestActor(req);
      const isAdmin = await checkIsAdmin(req);
      if (!isAdmin) {
        throw new HttpError(403, 'Forbidden. Only a community administrator can issue a refund.');
      }

      await paymentService.assertPaymentAccess(paymentId, { orgId, userId, isAdmin });

      const refundResult = await paymentService.processRefund(paymentId, amount, notes, { orgId, actorId: userId });

      res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: refundResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Simulate Payment Callback (Development / Testing)
   */
  async simulateCallback(req, res, next) {
    try {
      const { paymentId, isSuccess, errorReason, paymentMethod } = req.body;
      if (!paymentId) throw new HttpError(400, 'paymentId is required');

      if (config.nodeEnv !== 'test') {
        throw new HttpError(404, 'Payment simulation is unavailable outside automated tests.');
      }

      const { orgId, userId } = getRequestActor(req);
      const isAdmin = await checkIsAdmin(req);
      await paymentService.assertPaymentAccess(paymentId, { orgId, userId, isAdmin });

      const payment = await paymentService.simulatePaymentCallback(paymentId, isSuccess, errorReason, paymentMethod);
      
      res.status(200).json({
        success: true,
        message: 'Payment simulation processed',
        data: payment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Gateway Configuration Status
   */
  async getGatewayStatus(req, res, next) {
    try {
      const { orgId } = getRequestActor(req);
      const status = await paymentService.isGatewayConfigured(orgId);
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentStatus(req, res, next) {
    try {
      const { orgId, userId } = getRequestActor(req);
      const isAdmin = await checkIsAdmin(req);
      await paymentService.assertPaymentAccess(req.params.paymentId, { orgId, userId, isAdmin });
      const status = await paymentService.getPaymentStatus(req.params.paymentId);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
