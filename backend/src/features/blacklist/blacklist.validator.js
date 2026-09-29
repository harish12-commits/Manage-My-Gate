import { body, param, query } from 'express-validator';
import { isNormalizablePhone, toE164OrSelf } from '../../utils/phone.utils.js';

export const createBlacklistRules = [
  body('orgId')
    .notEmpty()
    .withMessage('Organization ID (orgId) is required')
    .isMongoId()
    .withMessage('Organization ID must be a valid Mongo ID'),
  body('name')
    .notEmpty()
    .withMessage('Target name is required')
    .isString()
    .withMessage('Target name must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Target name cannot exceed 100 characters'),
  body('reason')
    .notEmpty()
    .withMessage('Detailed reason for block is required')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
  body('phone')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Phone must be a string')
    .trim()
    .custom(isNormalizablePhone)
    .withMessage('Phone must be a valid phone number')
    .customSanitizer(toE164OrSelf),
  body('plate')
    .optional()
    .isString()
    .withMessage('Vehicle plate must be a string')
    .trim()
];

export const deleteBlacklistRules = [
  param('id')
    .notEmpty()
    .withMessage('Blacklist record ID is required')
    .isMongoId()
    .withMessage('Blacklist ID must be a valid Mongo ID')
];

export const checkMatchRules = [
  param('orgId')
    .notEmpty()
    .withMessage('Organization ID is required')
    .isMongoId()
    .withMessage('Organization ID must be a valid Mongo ID'),
  query('name')
    .optional()
    .isString()
    .trim(),
  query('phone')
    .optional()
    .isString()
    .trim(),
  query('plate')
    .optional()
    .isString()
    .trim()
];
