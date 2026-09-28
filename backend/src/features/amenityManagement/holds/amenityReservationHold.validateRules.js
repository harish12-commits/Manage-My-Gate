import { body, param } from 'express-validator';

export const createHoldRules = [
  body('facilityId').notEmpty().withMessage('facilityId is required').isMongoId().withMessage('Invalid facilityId'),
  body('resourceId').optional().isMongoId().withMessage('Invalid resourceId'),
  body('requestedStartDateTime').notEmpty().withMessage('requestedStartDateTime is required').isISO8601().withMessage('requestedStartDateTime must be valid ISO8601'),
  body('requestedEndDateTime').notEmpty().withMessage('requestedEndDateTime is required').isISO8601().withMessage('requestedEndDateTime must be valid ISO8601'),
  body('headcount').optional().isInt({ min: 1 }).withMessage('headcount must be at least 1'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be at least 1'),
  body('holdType')
    .optional()
    .isIn(['STANDARD', 'ADMIN_REVIEW', 'PAYMENT_PENDING'])
    .withMessage('Invalid holdType'),
  body('holdDurationMinutes').optional().isInt({ min: 1, max: 60 }).withMessage('holdDurationMinutes must be between 1 and 60'),
  body('unitId').optional().isMongoId().withMessage('Invalid unitId'),
];

export const holdIdParamRules = [
  param('holdId').notEmpty().withMessage('holdId parameter is required').isMongoId().withMessage('Invalid holdId'),
];
