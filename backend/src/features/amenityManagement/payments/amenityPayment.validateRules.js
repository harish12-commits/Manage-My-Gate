import { body } from 'express-validator';

export const paymentWebhookRules = [
  body('orgId').notEmpty().withMessage('orgId is required').isMongoId().withMessage('Invalid orgId'),
  body('holdId').optional().isMongoId().withMessage('Invalid holdId'),
  body('reservationId').optional().isMongoId().withMessage('Invalid reservationId'),
  body('paymentReference').notEmpty().withMessage('paymentReference is required').isString().trim(),
  body('status')
    .notEmpty()
    .withMessage('status is required')
    .isIn(['PAID', 'FAILED'])
    .withMessage("status must be 'PAID' or 'FAILED'"),
  body('paymentAmount').optional().isFloat({ min: 0 }).withMessage('paymentAmount must be non-negative'),
];

export const createAmenityPaymentOrderRules = [
  body('holdId').optional().isMongoId().withMessage('Invalid holdId'),
  body('reservationId').optional().isMongoId().withMessage('Invalid reservationId'),
  body().custom((b) => Boolean(b?.holdId) !== Boolean(b?.reservationId)).withMessage('Provide either holdId or reservationId'),
];

export const verifyAmenityPaymentRules = [
  body('paymentId').notEmpty().withMessage('paymentId is required').isMongoId().withMessage('Invalid paymentId'),
  body('orderId').notEmpty().withMessage('orderId is required').isString().trim(),
  body('razorpayPaymentId').notEmpty().withMessage('razorpayPaymentId is required').isString().trim(),
  body('razorpaySignature').notEmpty().withMessage('razorpaySignature is required').isString().trim(),
];
