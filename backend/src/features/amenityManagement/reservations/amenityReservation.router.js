import { Router } from 'express';
import amenityReservationController from './amenityReservation.controller.js';
import {
  confirmReservationRules,
  cancelReservationRules,
  reviewReservationRules,
  reservationIdParamRules,
  reservationNumberParamRules,
  listReservationsRules,
  payBalanceRules,
  collectPaymentRules,
} from './amenityReservation.validateRules.js';
import validate from '../../../middlewares/validator.middleware.js';
import isAuthenticated from '../../../middlewares/auth.middleware.js';
import tenantContext from '../../../middlewares/tenant.middleware.js';
import authorizePermission from '../../../middlewares/rbac.middleware.js';

const router = Router();

// Protect all reservation routes with Authentication and Tenant Context
router.use(isAuthenticated, tenantContext);

// POST /confirm - Confirm reservation from hold
router.post(
  '/confirm',
  authorizePermission('amenities', ['amenities', 'discover', 'my_booking']),
  validate(confirmReservationRules),
  amenityReservationController.confirm
);

// POST /:reservationId/cancel - Cancel reservation
router.post(
  '/:reservationId/cancel',
  authorizePermission('amenities', ['amenities', 'my_booking']),
  validate(cancelReservationRules),
  amenityReservationController.cancel
);

// POST /:reservationId/pay-balance - Resident pays the outstanding balance from the wallet
router.post(
  '/:reservationId/pay-balance',
  authorizePermission('amenities', ['amenities', 'my_booking']),
  validate(payBalanceRules),
  amenityReservationController.payBalance
);

// POST /:reservationId/collect-payment - Gate staff collect the balance in cash
router.post(
  '/:reservationId/collect-payment',
  authorizePermission('amenities', ['scanner', 'admin_calander', 'amenities']),
  validate(collectPaymentRules),
  amenityReservationController.collectPayment
);

// POST /:reservationId/review - Maker-checker review (Approve/Reject)
router.post(
  '/:reservationId/review',
  authorizePermission('amenities', ['amenities', 'admin_calander', 'settings']),
  validate(reviewReservationRules),
  amenityReservationController.review
);

// GET / - List reservations
router.get(
  '/',
  authorizePermission('amenities', ['amenities', 'admin_calander', 'my_booking']),
  validate(listReservationsRules),
  amenityReservationController.getAll
);

// GET /number/:reservationNumber - Get reservation by human reservation number
router.get(
  '/number/:reservationNumber',
  authorizePermission('amenities', ['amenities', 'admin_calander', 'my_booking']),
  validate(reservationNumberParamRules),
  amenityReservationController.getByNumber
);

// GET /:reservationId - Get reservation by ID
router.get(
  '/:reservationId',
  authorizePermission('amenities', ['amenities', 'admin_calander', 'my_booking']),
  validate(reservationIdParamRules),
  amenityReservationController.getById
);

export default router;
