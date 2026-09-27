/**
 * @deprecated Phase 8 Architectural Hardening:
 * RazorpayController is DEPRECATED.
 * All order creation and signature verification must flow through the canonical Unified Payment Core:
 * - Order Creation: POST /api/v1/payments/create-order via PaymentController / UnifiedPaymentService
 * - Signature Verification: POST /api/v1/payments/verify-signature via PaymentController / UnifiedPaymentService
 * - Webhook Ingress: POST /api/v1/payments/webhook via UnifiedPaymentService.processWebhook()
 *
 * This controller is maintained strictly as a backward-compatibility facade and delegates
 * directly to the Unified Payment Core.
 */

import unifiedPaymentService from './unifiedPayment.service.js';
import HttpError from '../../utils/httpError.utils.js';
import logger from '../../utils/logger.utils.js';

class RazorpayController {
  /**
   * @deprecated Use UnifiedPaymentService.createOrder or POST /api/v1/payments/create-order
   */
  async initiatePayment(req, res, next) {
    logger.warn('[DEPRECATED] Direct call to RazorpayController.initiatePayment. Use /api/v1/payments/create-order');
    try {
      const { amount, currency = 'INR', referenceId, referenceType, domain } = req.body;
      const userId = req.user?._id || req.body.userId;
      const orgId = req.user?.orgId || req.body.orgId || req.headers['x-organization-id'];

      if (!amount || !userId || !orgId) {
        throw new HttpError(400, 'Amount, User ID, and Organization ID are required.');
      }

      // Delegate to Canonical Unified Payment Core
      const order = await unifiedPaymentService.createOrder({
        orgId,
        userId,
        domain: domain || 'OTHER',
        referenceType: referenceType || 'Other',
        referenceId: referenceId || userId,
        amount: Number(amount),
        currency,
        paymentMethod: 'ONLINE',
      });

      res.status(200).json({
        success: true,
        order_id: order.gatewayOrderId,
        amount: order.amount,
        currency: order.currency,
        paymentId: order.paymentId,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @deprecated Use handleRazorpayWebhook in razorpay.webhook.js or POST /api/v1/payments/webhook
   */
  async razorpayWebhook(req, res, next) {
    logger.warn('[DEPRECATED] Direct call to RazorpayController.razorpayWebhook. Use /api/v1/payments/webhook');
    try {
      const webhookSignature = req.headers['x-razorpay-signature'];
      const rawBody = req.rawBody || req.body;

      if (!rawBody) {
        throw new HttpError(400, 'Raw body is required for webhook signature verification');
      }

      // Delegate to Canonical Webhook Ingress
      const result = await unifiedPaymentService.processWebhook(rawBody, webhookSignature, req.headers);
      res.status(200).json(result);
    } catch (error) {
      logger.error('[DEPRECATED Webhook] Processing failed:', { error: error.message });
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }
}

export default new RazorpayController();
