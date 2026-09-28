import { query } from 'express-validator';

export const checkAvailabilityRules = [
  query('facilityId').notEmpty().withMessage('facilityId query parameter is required').isMongoId().withMessage('Invalid facilityId'),
  query('resourceId').optional().isMongoId().withMessage('Invalid resourceId'),
  query('startDateTime').notEmpty().withMessage('startDateTime is required').isISO8601().withMessage('startDateTime must be valid ISO8601 date'),
  query('endDateTime').notEmpty().withMessage('endDateTime is required').isISO8601().withMessage('endDateTime must be valid ISO8601 date'),
  query('requestedQuantity').optional().isInt({ min: 1 }).withMessage('requestedQuantity must be at least 1'),
  query('headcount').optional().isInt({ min: 1 }).withMessage('headcount must be at least 1'),
  query('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be at least 1'),
];

export const getDailySlotsRules = [
  query('facilityId').notEmpty().withMessage('facilityId query parameter is required').isMongoId().withMessage('Invalid facilityId'),
  query('date').notEmpty().withMessage('date query parameter is required').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be in YYYY-MM-DD format'),
  query('resourceId').optional().isMongoId().withMessage('Invalid resourceId'),
  query('requestedQuantity').optional().isInt({ min: 1 }).withMessage('requestedQuantity must be at least 1'),
  query('headcount').optional().isInt({ min: 1 }).withMessage('headcount must be at least 1'),
  query('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be at least 1'),
];
