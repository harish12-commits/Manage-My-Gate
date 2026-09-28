import { Router } from 'express';
import amenityPaymentController from './amenityPayment.controller.js';
import {
  createAmenityPaymentOrderRules,
  verifyAmenityPaymentRules,
} from './amenityPayment.validateRules.js';
import validate from '../../../middlewares/validator.middleware.js';
import isAuthenticated from '../../../middlewares/auth.middleware.js';
import tenantContext from '../../../middlewares/tenant.middleware.js';
import authorizePermission from '../../../middlewares/rbac.middleware.js';

const router = Router();

// No public webhook here: gateway callbacks are verified and settled by the unified
// payment webhook (/api/webhooks/razorpay), which is the only path allowed to mark
// a payment captured.
router.use(isAuthenticated, tenantContext);

router.post(
  '/orders',
  authorizePermission('amenities', ['amenities', 'discover', 'my_booking']),
  validate(createAmenityPaymentOrderRules),
  amenityPaymentController.createOrder
);

router.post(
  '/verify',
  authorizePermission('amenities', ['amenities', 'discover', 'my_booking']),
  validate(verifyAmenityPaymentRules),
  amenityPaymentController.verifyPayment
);

export default router;
