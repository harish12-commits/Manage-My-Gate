import express from 'express';
import paymentController from './payment.controller.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import tenantContext from '../../middlewares/tenant.middleware.js';
import webhookRouter from './webhook/webhook.router.js';

const router = express.Router();

// Mount public webhook route (raw body parsing inside webhookRouter)
router.use('/webhook', webhookRouter);

// Browser and mobile payment actions are scoped to an active community. The
// signed Razorpay webhook above intentionally remains outside this middleware.
router.use(isAuthenticated, tenantContext);

// Order creation, verification, and refund endpoints
router.get('/status', paymentController.getGatewayStatus);
router.get('/:paymentId/status', paymentController.getPaymentStatus);
router.post('/create-order', paymentController.createOrder);
router.post('/verify-signature', paymentController.verifySignature);
router.post('/refund', paymentController.refund);

// Mock endpoint to simulate payment callback from UI
router.post('/simulate', paymentController.simulateCallback);

export default router;
