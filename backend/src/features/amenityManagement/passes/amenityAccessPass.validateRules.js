import { body, param } from 'express-validator';

export const passCheckInRules = [
  body('rawToken').notEmpty().withMessage('rawToken is required').isString().trim(),
  body('gateId').optional().isString().trim(),
];

export const passCheckOutRules = [
  body('rawToken').notEmpty().withMessage('rawToken is required').isString().trim(),
  body('inspectionDetails.isDamaged').optional().isBoolean().withMessage('isDamaged must be a boolean'),
  body('inspectionDetails.damageNotes').optional().isString().trim(),
  body('inspectionDetails.assessedPenaltyAmount').optional().isFloat({ min: 0 }).withMessage('assessedPenaltyAmount must be >= 0'),
  body('inspectionDetails.damageCharge').optional().isFloat({ min: 0 }).withMessage('damageCharge must be >= 0'),
];

export const passIdParamRules = [
  param('passId').notEmpty().withMessage('passId parameter is required').isMongoId().withMessage('Invalid passId'),
];

export const passReservationIdParamRules = [
  param('reservationId').notEmpty().withMessage('reservationId parameter is required').isMongoId().withMessage('Invalid reservationId'),
];

export const revokePassRules = [
  param('passId').notEmpty().withMessage('passId parameter is required').isMongoId().withMessage('Invalid passId'),
  body('reason').notEmpty().withMessage('Revocation reason is required').isString().trim(),
];
