import crypto from 'crypto';
import platformOrderService from '../platformOrder/platformOrder.service.js';
import logger from '../../utils/logger.utils.js';

class WebhookController {
  async handleRazorpayWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!signature || !secret) {
        logger.warn('[Webhook] Missing signature or secret for Razorpay webhook');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      // Generate HMAC SHA256 hex digest using the raw request body
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.body) // req.body is raw Buffer because of express.raw
        .digest('hex');

      // Compare using crypto.timingSafeEqual to prevent timing attacks
      const sigBuf = Buffer.from(String(signature));
      const expectedBuf = Buffer.from(generatedSignature);
      const isSignatureValid = sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);

      if (!isSignatureValid) {
        logger.warn('[Webhook] Signature mismatch for Razorpay webhook');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      // Process DB updates
      const payload = JSON.parse(req.body.toString());
      
      // Pass the payload to the service layer for zero-error processing
      await platformOrderService.handlePaymentSuccess(payload);

      // Acknowledge ONLY after successful persistence
      res.status(200).send('OK');

    } catch (error) {
      logger.error('[Webhook] Error handling Razorpay webhook:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  }
}

export default new WebhookController();
