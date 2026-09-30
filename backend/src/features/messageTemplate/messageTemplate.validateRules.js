import { body, param } from 'express-validator';

/**
 * Validation rules for creating a message template.
 */
export const createTemplateRules = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isString()
    .withMessage('Template name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Template name must be between 2 and 100 characters'),

  body('type')
    .notEmpty()
    .withMessage('Template channel type is required')
    .isString()
    .withMessage('Template type must be a string')
    .trim()
    .toLowerCase()
    .isIn(['email', 'sms', 'whatsapp'])
    .withMessage('Invalid channel type. Supported: email, sms, whatsapp'),

  body('purpose')
    .notEmpty()
    .withMessage('Template purpose is required')
    .isString()
    .withMessage('Template purpose must be a string')
    .trim()
    .isIn(['user_invitation', 'invoice_generated', 'invoice_reminder', 'invoice_overdue', 'invoice_receipt', 'default'])
    .withMessage('Invalid purpose. Supported: user_invitation, invoice_generated, invoice_reminder, invoice_overdue, invoice_receipt, default'),

  body('subject')
    .optional()
    .isString()
    .withMessage('Subject must be a string')
    .trim()
    .isLength({ max: 150 })
    .withMessage('Subject cannot exceed 150 characters'),

  body('cc')
    .optional()
    .isString()
    .withMessage('CC must be a string')
    .trim(),

  body('bcc')
    .optional()
    .isString()
    .withMessage('BCC must be a string')
    .trim(),

  body('body')
    .notEmpty()
    .withMessage('Template body content is required')
    .isString()
    .withMessage('Template body must be a string')
    .trim()
    .custom((value, { req }) => {
      if (req.body.purpose === 'user_invitation' && !value.includes('{{invite_link}}')) {
        throw new Error('For user invitation templates, the body must contain the placeholder "{{invite_link}}"');
      }
      // Billing emails must keep the way back to the invoice (receipts excepted).
      if (['invoice_generated', 'invoice_reminder', 'invoice_overdue'].includes(req.body.purpose) && !value.includes('{{app_link}}')) {
        throw new Error('Billing email templates must contain the placeholder "{{app_link}}"');
      }
      if (String(req.body.purpose || '').startsWith('invoice_') && req.body.type && req.body.type !== 'email') {
        throw new Error('Billing templates are email-only');
      }
      return true;
    }),
];

/**
 * Validation rules for updating a template.
 */
export const updateTemplateRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID format'),
  ...createTemplateRules,
];

export default {
  createTemplateRules,
  updateTemplateRules,
};
