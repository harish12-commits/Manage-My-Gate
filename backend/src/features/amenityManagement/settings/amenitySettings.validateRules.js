import { body } from 'express-validator';

export const updateAmenitySettingsRules = [
  body('quota.enabled').optional().isBoolean().withMessage('quota.enabled must be a boolean'),
  body('quota.limitMinutes').optional().isInt({ min: 60 }).withMessage('quota.limitMinutes must be at least 60'),
  body('quota.longDurationLimitMinutes')
    .optional()
    .isInt({ min: 60 })
    .withMessage('quota.longDurationLimitMinutes must be at least 60'),
  body('approvalTimeoutHours').optional().isInt({ min: 1, max: 720 }).withMessage('approvalTimeoutHours must be 1-720'),
  body('checkInEarlyMinutes').optional().isInt({ min: 0, max: 240 }).withMessage('checkInEarlyMinutes must be 0-240'),
  body('noShowGraceMinutes').optional().isInt({ min: 0, max: 1440 }).withMessage('noShowGraceMinutes must be 0-1440'),
];
