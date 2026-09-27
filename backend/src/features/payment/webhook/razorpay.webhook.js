import crypto from 'crypto';
import unifiedPaymentService, { verifyWebhookSignature } from '../unifiedPayment.service.js';
import logger from '../../../utils/logger.utils.js';

/**
 * Validates Razorpay HMAC SHA256 webhook signature.
 * Exported for backward compatibility with legacy consumers.
 * @param {Buffer|string} rawBody - Raw HTTP body payload
 * @param {string} signature - x-razorpay-signature header value
 * @param {string} secret - Webhook secret key
 * @returns {boolean}
 */
export const verifyRazorpaySignature = (rawBody, signature, secret) => {
  return verifyWebhookSignature(rawBody, signature, secret);
};

/**
 * Authoritative Webhook Controller for resident Razorpay payments.
 * Delegates to UnifiedPaymentService for signature verification, tenant credential resolution,
 * database-level OCC idempotency, and atomic domain settlement.
 */
export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || req.body;

    const result = await unifiedPaymentService.processWebhook(rawBody, signature, req.headers);

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error handling Razorpay webhook:', { error: error.message });
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Webhook processing failed',
    });
  }
};

export default {
  handleRazorpayWebhook,
  verifyRazorpaySignature,
};
