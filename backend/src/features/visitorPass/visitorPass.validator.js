import { body } from 'express-validator';

export const createPassRules = [
  body('orgId')
    .optional()
    .isMongoId()
    .withMessage('Organization ID must be a valid Mongo ID'),

  body('createdById')
    .optional()
    .isMongoId()
    .withMessage('Creator ID must be a valid Mongo ID'),
  body('villaId')
    .optional()
    .isMongoId()
    .withMessage('Villa ID must be a valid Mongo ID'),
  body('roleId')
    .optional()
    .isMongoId()
    .withMessage('Role ID must be a valid Mongo ID'),

  body('passType')
    .notEmpty()
    .withMessage('Pass type is required')
    .isIn(['GUEST', 'DELIVERY', 'CAB', 'SERVICE', 'ADMIN_GUEST'])
    .withMessage('Pass type must be GUEST, DELIVERY, CAB, SERVICE, or ADMIN_GUEST'),

  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body('isIdProofPass')
    .optional()
    .isBoolean()
    .withMessage('isIdProofPass must be a boolean'),
  body('isGroupPass')
    .optional()
    .isBoolean()
    .withMessage('isGroupPass must be a boolean'),

  body('groupGuests')
    .optional()
    .isArray()
    .withMessage('groupGuests must be an array'),

  body('groupGuests.*.name')
    .optional()
    .isString()
    .withMessage('Guest name must be a string')
    .trim(),

  body('groupGuests.*.phone')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Guest phone must be a string')
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('Guest phone must be exactly 10 digits'),

  body('visitorDetails.name')
    .optional()
    .isString()
    .withMessage('Visitor name must be a string')
    .trim(),

  body('visitorDetails.phone')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Visitor phone must be a string')
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('Visitor phone must be exactly 10 digits'),

  body('visitorDetails.idProofType')
    .optional()
    .isString()
    .withMessage('ID proof type must be a string')
    .trim(),

  body('visitorDetails.idProofNumber')
    .optional()
    .isString()
    .withMessage('ID proof number must be a string')
    .trim(),

  body('vehicleDetails.vendor')
    .optional()
    .isString()
    .withMessage('Vehicle vendor must be a string')
    .trim(),

  body('vehicleDetails.number')
    .optional()
    .isString()
    .withMessage('Vehicle number must be a string')
    .trim()
    .toUpperCase(),

  body('vehicleDetails.vehicleType')
    .optional()
    .isString()
    .withMessage('Vehicle type must be a string')
    .trim()
    .toUpperCase(),

  body('deliveryDetails.partner')
    .optional()
    .isString()
    .withMessage('Delivery partner must be a string')
    .trim(),

  body('deliveryDetails.orderId')
    .optional()
    .isString()
    .withMessage('Order ID must be a string')
    .trim(),

  body('deliveryDetails.packageCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Package count must be an integer of at least 1'),

  body('deliveryDetails.deliveryAction')
    .optional()
    .isString()
    .withMessage('Delivery action must be a string')
    .trim(),

  body('deliveryDetails.instructions')
    .optional()
    .isString()
    .withMessage('Delivery instructions must be a string')
    .trim(),

  body('serviceDetails.category')
    .optional()
    .isString()
    .withMessage('Service category must be a string')
    .trim(),

  body('serviceDetails.notes')
    .optional()
    .isString()
    .withMessage('Service notes must be a string')
    .trim(),

  body('validity.startDate')
    .notEmpty()
    .withMessage('Validity start date is required')
    .isISO8601()
    .withMessage('Validity start date must be a valid ISO8601 date'),

  body('validity.endDate')
    .notEmpty()
    .withMessage('Validity end date is required')
    .isISO8601()
    .withMessage('Validity end date must be a valid ISO8601 date'),

  body('validity.timeWindowStart')
    .optional()
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Validity timeWindowStart must be in HH:mm format (24-hour)'),

  body('validity.timeWindowEnd')
    .optional()
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Validity timeWindowEnd must be in HH:mm format (24-hour)'),

  body('validity.timeWindows')
    .optional()
    .isArray()
    .withMessage('Validity timeWindows must be an array'),

  body('validity.timeWindows.*.start')
    .optional()
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Validity time window start must be in HH:mm format (24-hour)'),

  body('validity.timeWindows.*.end')
    .optional()
    .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Validity time window end must be in HH:mm format (24-hour)'),

  body('validity.allowedDays')
    .optional()
    .isArray()
    .withMessage('Validity allowedDays must be an array of numbers representing days of the week'),

  body('validity.allowedDays.*')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('allowedDays elements must be integers between 0 (Sunday) and 6 (Saturday)'),

  body('usageLimit.maxUses')
    .optional()
    .isInt({ min: 1 })
    .withMessage('usageLimit.maxUses must be an integer of at least 1')
];

export const updatePassStatusRules = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'])
    .withMessage('Status must be PENDING, ACTIVE, REVOKED, or EXPIRED'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be at most 500 characters')
];
