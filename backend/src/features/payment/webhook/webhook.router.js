import express from 'express';
import { handleRazorpayWebhook } from './razorpay.webhook.js';

const webhookRouter = express.Router();

/**
 * Authoritative resident payment webhook ingress.
 * Captures raw buffer for HMAC SHA256 signature verification.
 * Supports both /api/payments/webhook and /api/payments/webhook/razorpay.
 */
webhookRouter.post('/', express.raw({ type: 'application/json' }), handleRazorpayWebhook);
webhookRouter.post('/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

export default webhookRouter;
