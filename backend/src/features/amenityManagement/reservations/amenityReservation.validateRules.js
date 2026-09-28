import { body, param, query } from 'express-validator';

export const confirmReservationRules = [
  body('holdId').notEmpty().withMessage('holdId is required').isMongoId().withMessage('Invalid holdId'),
  body('paymentMethod').optional().isIn(['WALLET', 'RAZORPAY', 'WAIVED']).withMessage('Invalid payment method'),
  body('paymentId').optional().isMongoId().withMessage('Invalid payment ID'),
  body('notes').optional().isString().trim(),
];

export const cancelReservationRules = [
  param('reservationId').notEmpty().withMessage('reservationId parameter is required').isMongoId().withMessage('Invalid reservationId'),
  body('reason').optional().isString().trim(),
];

export const reviewReservationRules = [
  param('reservationId').notEmpty().withMessage('reservationId parameter is required').isMongoId().withMessage('Invalid reservationId'),
  body('action')
    .notEmpty()
    .withMessage('action is required')
    .isIn(['APPROVE', 'REJECT'])
    .withMessage("action must be 'APPROVE' or 'REJECT'"),
  body('rejectionReason')
    .if(body('action').equals('REJECT'))
    .isString()
    .trim()
    .notEmpty()
    .withMessage('A reason is required to reject a booking'),
];

export const reservationIdParamRules = [
  param('reservationId').notEmpty().withMessage('reservationId parameter is required').isMongoId().withMessage('Invalid reservationId'),
];

export const reservationNumberParamRules = [
  param('reservationNumber').notEmpty().withMessage('reservationNumber parameter is required').isString().trim(),
];

export const listReservationsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('facilityId').optional().isMongoId().withMessage('Invalid facilityId filter'),
  query('resourceId').optional().isMongoId().withMessage('Invalid resourceId filter'),
  query('residentId').optional().isMongoId().withMessage('Invalid residentId filter'),
  query('unitId').optional().isMongoId().withMessage('Invalid unitId filter'),
  query('bookingStatus')
    .optional()
    .isIn(['PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED', 'REJECTED'])
    .withMessage('Invalid bookingStatus filter'),
  query('paymentStatus')
    .optional()
    .isIn(['NOT_REQUIRED', 'NOT_APPLICABLE', 'PENDING', 'HELD_AUTHORIZED', 'ADVANCE_PAID', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'])
    .withMessage('Invalid paymentStatus filter'),
  query('adminReviewStatus').optional().isIn(['PENDING', 'RESOLVED']).withMessage('Invalid adminReviewStatus filter'),
  query('approvalStatus')
    .optional()
    .isIn(['NOT_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'])
    .withMessage('Invalid approvalStatus filter'),
  query('startDate').optional().isISO8601().withMessage('startDate must be valid ISO8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be valid ISO8601 date'),
  query('search').optional().isString().trim(),
];

export const payBalanceRules = [
  param('reservationId').isMongoId().withMessage('Invalid reservationId'),
  body('paymentMethod').isIn(['WALLET']).withMessage('Pay the balance from the Digital Wallet, or use online payment'),
];

export const collectPaymentRules = [
  param('reservationId').isMongoId().withMessage('Invalid reservationId'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
];

export const resolveReviewRules = [
  param('reservationId').isMongoId().withMessage('Invalid reservationId'),
  body('action').isIn(['FORFEIT', 'REFUND_POLICY', 'REFUND_CUSTOM', 'EXTEND']).withMessage('Invalid review action'),
  body('refundPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('refundPercentage must be 0-100'),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];
