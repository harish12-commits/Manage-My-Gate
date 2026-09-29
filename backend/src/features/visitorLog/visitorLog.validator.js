import { body } from 'express-validator';
import { isNormalizablePhone, toE164OrSelf } from '../../utils/phone.utils.js';

export const preApprovedEntryRules = [
  body('passId')
    .optional()
    .isMongoId()
    .withMessage('Pass ID must be a valid Mongo ID'),

  body('code')
    .optional()
    .isString()
    .withMessage('Pass code must be a string')
    .trim(),

  body('guardId')
    .optional()
    .isMongoId()
    .withMessage('Guard ID must be a valid Mongo ID'),

  body('gateName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Gate name must be at most 120 characters')
];

export const walkInRequestRules = [
  body('orgId')
    .optional()
    .isMongoId()
    .withMessage('Organization ID must be a valid Mongo ID'),

  body('guardId')
    .optional()
    .isMongoId()
    .withMessage('Guard ID must be a valid Mongo ID'),

  body('residentId')
    .notEmpty()
    .withMessage('Resident ID is required')
    .isMongoId()
    .withMessage('Resident ID must be a valid Mongo ID'),

  body('gateName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Gate name must be at most 120 characters'),

  body('snapshot.visitorName')
    .optional()
    .isString()
    .withMessage('Visitor name must be a string')
    .trim(),

  body('snapshot.phone')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .custom(isNormalizablePhone)
    .withMessage('Visitor phone must be a valid phone number')
    .customSanitizer(toE164OrSelf),

  body('snapshot.idProofNumber')
    .optional()
    .isString()
    .withMessage('ID proof number must be a string')
    .trim(),

  body('snapshot.vehicleNumber')
    .optional()
    .isString()
    .withMessage('Vehicle number must be a string')
    .trim()
    .toUpperCase()
];

export const resolveWalkInRules = [
  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['APPROVE', 'REJECT'])
    .withMessage('Action must be APPROVE or REJECT')
];

export const checkoutRules = [
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be at most 500 characters'),

  body('gateName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Gate name must be at most 120 characters'),
];
