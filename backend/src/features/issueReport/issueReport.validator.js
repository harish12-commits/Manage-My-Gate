import { body, query, param } from 'express-validator';
import { ATTACHMENT_FILENAME_PATTERN } from './middlewares/upload.middleware.js';
import { REPORT_TYPES, REPORT_MODULES, SUPPORTED_PLATFORMS, REPORT_SOURCES, SORTABLE_FIELDS } from './issueReport.constants.js';

export const createReportRules = [
  // 1. Report Type Validation
  body('reportType')
    .trim()
    .notEmpty()
    .withMessage('Report type is required.')
    .isIn(Object.values(REPORT_TYPES))
    .withMessage(`Invalid report type. Allowed values: ${Object.values(REPORT_TYPES).join(', ')}`),

  // 2. Feature / Module Validation
  body('feature')
    .trim()
    .notEmpty()
    .withMessage('Feature module is required.')
    .isIn(Object.values(REPORT_MODULES))
    .withMessage(`Invalid feature module. Allowed values: ${Object.values(REPORT_MODULES).join(', ')}`),

  // 3. Title Validation
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required.')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters.')
    .custom((val) => {
      if (!val || val.trim().length === 0) {
        throw new Error('Title cannot consist of whitespace only.');
      }
      return true;
    }),

  // 4. Description Validation
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required.')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters.')
    .custom((val) => {
      if (!val || val.trim().length === 0) {
        throw new Error('Description cannot consist of whitespace only.');
      }
      return true;
    }),

  body('source')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(REPORT_SOURCES)
    .withMessage(`Invalid source. Allowed values: ${REPORT_SOURCES.join(', ')}`),

  // 5. Technical Context Sanitization & Validation
  body('technicalContext')
    .optional()
    .customSanitizer((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    })
    .custom((context) => {
      if (context === null) {
        throw new Error('Technical context must be a valid JSON object.');
      }
      if (typeof context !== 'object' || Array.isArray(context)) {
        throw new Error('Technical context must be an object.');
      }

      // Disallow arbitrary top-level keys
      const allowedKeys = ['appVersion', 'platform', 'deviceModel', 'osVersion'];
      const extraKeys = Object.keys(context).filter((k) => !allowedKeys.includes(k));
      if (extraKeys.length > 0) {
        throw new Error(`Technical context contains unrecognized keys: ${extraKeys.join(', ')}`);
      }

      if (context.platform && !SUPPORTED_PLATFORMS.includes(String(context.platform).toLowerCase())) {
        throw new Error(`Invalid platform: ${context.platform}. Allowed values: ${SUPPORTED_PLATFORMS.join(', ')}`);
      }

      if (context.appVersion && typeof context.appVersion !== 'string') {
        throw new Error('appVersion must be a string.');
      }
      if (context.deviceModel && typeof context.deviceModel !== 'string') {
        throw new Error('deviceModel must be a string.');
      }
      if (context.osVersion && typeof context.osVersion !== 'string') {
        throw new Error('osVersion must be a string.');
      }

      return true;
    }),
];

export const queryPlatformReportsRules = [
  query('page')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer >= 1.'),

  query('limit')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100.'),

  query('reportType')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(Object.values(REPORT_TYPES))
    .withMessage(`Invalid reportType filter. Allowed values: ${Object.values(REPORT_TYPES).join(', ')}`),

  query('feature')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(Object.values(REPORT_MODULES))
    .withMessage(`Invalid feature filter. Allowed values: ${Object.values(REPORT_MODULES).join(', ')}`),

  query('platform')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(SUPPORTED_PLATFORMS)
    .withMessage(`Invalid platform filter. Allowed values: ${SUPPORTED_PLATFORMS.join(', ')}`),

  query('organisationId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('organisationId must be a valid Mongo ID.'),

  query('sortBy')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(SORTABLE_FIELDS)
    .withMessage(`Invalid sortBy. Allowed values: ${SORTABLE_FIELDS.join(', ')}`),

  query('sortOrder')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc.'),

  query('search')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Search term cannot exceed 100 characters.'),

  query('startDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date.'),

  query('endDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date.'),
];

export const getAttachmentRules = [
  param('filename')
    .matches(ATTACHMENT_FILENAME_PATTERN)
    .withMessage('Invalid attachment file name.'),
];

export const getReportByIdRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid report ID format.'),
];
