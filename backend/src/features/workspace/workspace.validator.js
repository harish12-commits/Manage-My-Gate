import { body, param } from 'express-validator';

export const createWorkspaceRules = [
  body('workspaceName')
    .notEmpty()
    .withMessage('Workspace name is required')
    .isString()
    .withMessage('Workspace name must be a string')
    .trim(),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim(),

  body('organizationId')
    .optional()
    .isMongoId()
    .withMessage('Organization ID must be a valid Mongo ID'),

  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'Pending'])
    .withMessage('Status must be Active, Inactive, or Pending'),

  body('organizationName')
    .optional()
    .isString()
    .withMessage('Organization name must be a string')
    .trim(),

  body('timeZone')
    .optional()
    .isString()
    .withMessage('Time zone must be a string')
    .trim(),

  body('language')
    .optional()
    .isString()
    .withMessage('Language must be a string')
    .trim(),

  body('countryCode')
    .optional({ checkFalsy: true })
    .isISO31661Alpha2()
    .withMessage('Country must be a valid ISO country code')
    .toUpperCase(),

  body('contactEmail')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Contact email must be a valid email address')
    .normalizeEmail(),

  body('contactPhone')
    .optional()
    .isString()
    .withMessage('Contact phone must be a string')
    .trim(),
];

export const updateWorkspaceRules = [
  body('workspaceName')
    .optional()
    .isString()
    .withMessage('Workspace name must be a string')
    .trim(),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim(),

  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'Pending'])
    .withMessage('Status must be Active, Inactive, or Pending'),

  body('organizationName')
    .optional()
    .isString()
    .withMessage('Organization name must be a string')
    .trim(),

  body('timeZone')
    .optional()
    .isString()
    .withMessage('Time zone must be a string')
    .trim(),

  body('language')
    .optional()
    .isString()
    .withMessage('Language must be a string')
    .trim(),

  body('contactEmail')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Contact email must be a valid email address')
    .normalizeEmail(),

  body('contactPhone')
    .optional()
    .isString()
    .withMessage('Contact phone must be a string')
    .trim(),
];

export const addModuleRules = [
  body('moduleName')
    .notEmpty()
    .withMessage('Module name is required')
    .isString()
    .withMessage('Module name must be a string')
    .trim(),

  body('moduleKey')
    .notEmpty()
    .withMessage('Module key is required')
    .isString()
    .withMessage('Module key must be a string')
    .trim(),

  body('route')
    .notEmpty()
    .withMessage('Route is required')
    .isString()
    .withMessage('Route must be a string')
    .trim(),

  body('icon')
    .notEmpty()
    .withMessage('Icon is required')
    .isString()
    .withMessage('Icon must be a string')
    .trim(),

  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),

  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),

  body('sidebarVisible')
    .optional()
    .isBoolean()
    .withMessage('Sidebar visible must be a boolean'),
];

export const updateModuleRules = [
  body('moduleName')
    .optional()
    .isString()
    .withMessage('Module name must be a string')
    .trim(),

  body('moduleKey')
    .optional()
    .isString()
    .withMessage('Module key must be a string')
    .trim(),

  body('route')
    .optional()
    .isString()
    .withMessage('Route must be a string')
    .trim(),

  body('icon')
    .optional()
    .isString()
    .withMessage('Icon must be a string')
    .trim(),

  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),

  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),

  body('sidebarVisible')
    .optional()
    .isBoolean()
    .withMessage('Sidebar visible must be a boolean'),
];

export const toggleModuleRules = [
  body('enabled')
    .exists({ checkNull: true })
    .withMessage('Enabled is required')
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
];

export const reorderModulesRules = [
  body('orders')
    .isArray()
    .withMessage('Orders must be an array')
    .bail()
    .custom((value) => {
      if (!value.every(item => typeof item === 'object' && item.moduleId && typeof item.displayOrder === 'number')) {
        throw new Error('Every order item must have moduleId and displayOrder number');
      }
      return true;
    }),
];

export const idParamRules = [
  param('id')
    .custom(value => value === 'current' || /^[0-9a-fA-F]{24}$/.test(value))
    .withMessage('Workspace ID must be a valid Mongo ID or "current"'),
];

export const workspaceIdParamRules = [
  param('workspaceId')
    .custom(value => value === 'current' || /^[0-9a-fA-F]{24}$/.test(value))
    .withMessage('Workspace ID must be a valid Mongo ID or "current"'),
];

export const workspaceAndModuleIdParamRules = [
  param('workspaceId')
    .custom(value => value === 'current' || /^[0-9a-fA-F]{24}$/.test(value))
    .withMessage('Workspace ID must be a valid Mongo ID or "current"'),
  param('moduleId')
    .custom(value => /^[0-9a-fA-F]{24}$/.test(value) || (typeof value === 'string' && value.trim().length > 0))
    .withMessage('Module ID must be a valid Mongo ID or module key'),
];

export const addMemberRules = [
  body('identifier')
    .notEmpty()
    .withMessage('Identifier is required')
    .isString()
    .withMessage('Identifier must be a string')
    .trim(),
];

