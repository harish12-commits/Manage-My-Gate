import { body, param, query } from 'express-validator';

export const createFacilityRules = [
  body('name').notEmpty().withMessage('Facility name is required').isString().trim(),
  body('code').notEmpty().withMessage('Facility code is required').isString().trim(),
  body('archetype')
    .notEmpty()
    .withMessage('Archetype is required')
    .isIn(['SHARED_CAPACITY', 'EXCLUSIVE_HOURLY', 'EVENT_SPACE', 'ROOM_RESOURCE', 'INVENTORY_TOOLS'])
    .withMessage('Invalid facility archetype'),
  body('description').optional().isString().trim(),
  body('location').custom((val, { req }) => {
    const isDraft = Boolean(req.body.isDraft === true || req.body.status === 'DRAFT');
    if (!isDraft) {
      if (!val || typeof val !== 'string' || !val.trim()) {
        throw new Error('Location / Zone is required when publishing a facility');
      }
    } else if (val !== undefined && typeof val !== 'string') {
      throw new Error('Location must be a string');
    }
    return true;
  }),
  body('category').optional().isString().trim(),
  body('images').optional().isArray().withMessage('Images must be an array of strings'),
  body('images.*').optional().isString().withMessage('Image item must be a string'),
  body('imageUrl').optional().isString().trim(),
  body('openDays').optional().isArray().withMessage('openDays must be an array of numbers (0-6)'),
  body('openDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each open day must be 0-6'),
  body('operatingHours')
    .optional()
    .custom((val) => {
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const entry = val[i];
          if (!entry) continue;
          if (entry.dayOfWeek !== undefined && (entry.dayOfWeek < 0 || entry.dayOfWeek > 6)) {
            throw new Error(`dayOfWeek must be between 0 and 6 at index ${i}`);
          }
          if (entry.openTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(entry.openTime)) {
            throw new Error(`Invalid operating open time format (HH:MM) at index ${i}`);
          }
          if (entry.closeTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(entry.closeTime)) {
            throw new Error(`Invalid operating close time format (HH:MM) at index ${i}`);
          }
          if (entry.isOpen !== false && entry.openTime && entry.closeTime) {
            const [openH, openM] = entry.openTime.split(':').map(Number);
            const [closeH, closeM] = entry.closeTime.split(':').map(Number);
            if (openH * 60 + openM >= closeH * 60 + closeM) {
              throw new Error(`closeTime (${entry.closeTime}) must be after openTime (${entry.openTime}) on day ${entry.dayOfWeek ?? i}`);
            }
          }
        }
        return true;
      } else if (typeof val === 'object' && val !== null) {
        if (val.openTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(val.openTime)) {
          throw new Error('Invalid operating open time format (HH:MM)');
        }
        if (val.closeTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(val.closeTime)) {
          throw new Error('Invalid operating close time format (HH:MM)');
        }
        if (val.openTime && val.closeTime) {
          const [openH, openM] = val.openTime.split(':').map(Number);
          const [closeH, closeM] = val.closeTime.split(':').map(Number);
          if (openH * 60 + openM >= closeH * 60 + closeM) {
            throw new Error(`closeTime (${val.closeTime}) must be after openTime (${val.openTime})`);
          }
        }
        return true;
      }
      throw new Error('operatingHours must be an array of schedule objects');
    }),
  body('minNoticeHours').optional().isInt({ min: 0 }).withMessage('minNoticeHours must be a non-negative integer'),
  body('advanceBookingDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('advanceBookingDays must be an integer >= 1'),
  body('maxAdvanceBookingDays')
    .optional()
    .isInt({ min: 0 })
    .withMessage('maxAdvanceBookingDays must be a non-negative integer'),
  body('maxCapacity').optional().isInt({ min: 1 }).withMessage('maxCapacity must be at least 1'),
  body('maxHeadcountPerReservation')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxHeadcountPerReservation must be at least 1'),
  body('setupBufferMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('setupBufferMinutes must be a non-negative integer'),
  body('slotDurationMinutes')
    .optional()
    .isInt({ min: 15 })
    .withMessage('slotDurationMinutes must be at least 15 minutes'),
  body('isMultiResourceFacility').optional().isBoolean().withMessage('isMultiResourceFacility must be a boolean'),
  body('subRooms').optional().isArray().withMessage('subRooms must be an array'),
  body('subRooms.*.name').optional().isString().trim().notEmpty().withMessage('Sub-room name cannot be empty'),
  body('subRooms.*.capacity').optional().isInt({ min: 1 }).withMessage('Sub-room capacity must be at least 1'),
  body('roomAmenities').optional().isArray().withMessage('roomAmenities must be an array of strings'),
  body('roomAmenities.*').optional().isString().trim().withMessage('roomAmenity item must be a string'),
  body('availableStock').optional().isInt({ min: 0 }).withMessage('availableStock cannot be negative'),
  body('maxLoanHours').optional().isInt({ min: 1 }).withMessage('maxLoanHours must be at least 1'),
  body('requiresInspection').optional().isBoolean().withMessage('requiresInspection must be a boolean'),
  body('bookingMode').optional().isIn(['FULL_DAY', 'SESSION', 'HOURLY']).withMessage('bookingMode must be FULL_DAY, SESSION or HOURLY'),
  body('sessions').optional().isArray().withMessage('sessions must be an array'),
  body('sessions.*.name').optional().isString().trim().notEmpty().withMessage('Session name cannot be empty'),
  body('sessions.*.startTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Session startTime must be HH:MM'),
  body('sessions.*.endTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Session endTime must be HH:MM'),
  body('sessions.*.price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Session price cannot be negative'),
  body('stayMode').optional().isIn(['HOURLY', 'OVERNIGHT']).withMessage('stayMode must be HOURLY or OVERNIGHT'),
  body('checkInTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('checkInTime must be HH:MM'),
  body('checkOutTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('checkOutTime must be HH:MM'),
  body('maxNights').optional().isInt({ min: 1 }).withMessage('maxNights must be at least 1'),
  body('pricingConfig.pricingType')
    .optional()
    .isIn(['FREE', 'HOURLY', 'DAILY', 'FIXED_EVENT', 'TIERED'])
    .withMessage('Invalid pricingType'),
  body('pricingConfig.baseRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('baseRate must be a non-negative number'),
  body('pricingConfig.taxPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('taxPercentage must be between 0 and 100'),
  body('pricingConfig.securityDeposit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('securityDeposit must be a non-negative number'),
  body('pricingConfig.currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('currency must be 3-letter code'),
  body('requiresApproval').optional().isBoolean().withMessage('requiresApproval must be a boolean'),
  body('approvalWorkflow.requireAdminApproval')
    .optional()
    .isBoolean()
    .withMessage('requireAdminApproval must be a boolean'),
  body('approvalWorkflow.approvalTimeoutHours')
    .optional()
    .isInt({ min: 1 })
    .withMessage('approvalTimeoutHours must be at least 1'),
  body('approvalWorkflow.depositRequired')
    .optional()
    .isBoolean()
    .withMessage('depositRequired must be a boolean'),
  body('cancellationPolicy.isAllowed')
    .optional()
    .isBoolean()
    .withMessage('isAllowed must be a boolean'),
  body('cancellationPolicy.refundCutoffHours')
    .optional()
    .isInt({ min: 0 })
    .withMessage('refundCutoffHours must be a non-negative integer'),
  body('cancellationPolicy.refundPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('refundPercentage must be between 0 and 100'),
  body('cancellationPolicy.allowCancellation')
    .optional()
    .isBoolean()
    .withMessage('allowCancellation must be a boolean'),
  body('cancellationPolicy.freeCancellationHours')
    .optional()
    .isInt({ min: 0 })
    .withMessage('freeCancellationHours must be non-negative'),
  body('cancellationPolicy.cancellationFeePercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('cancellationFeePercentage must be between 0 and 100'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'])
    .withMessage('Invalid facility status'),
  body('isDraft').optional().isBoolean().withMessage('isDraft must be a boolean'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const updateFacilityRules = [
  body('name').optional().notEmpty().withMessage('Facility name cannot be empty').isString().trim(),
  body('code').optional().notEmpty().withMessage('Facility code cannot be empty').isString().trim(),
  body('archetype')
    .optional()
    .isIn(['SHARED_CAPACITY', 'EXCLUSIVE_HOURLY', 'EVENT_SPACE', 'ROOM_RESOURCE', 'INVENTORY_TOOLS'])
    .withMessage('Invalid facility archetype'),
  body('description').optional().isString().trim(),
  body('location')
    .optional()
    .custom((val, { req }) => {
      if (val !== undefined) {
        if (typeof val !== 'string') {
          throw new Error('Location must be a string');
        }
        const isPublishing = req.body.status === 'ACTIVE' || (req.body.isDraft === false && req.body.status !== 'DRAFT');
        if (isPublishing && !val.trim()) {
          throw new Error('Location / Zone cannot be empty when publishing a facility');
        }
      }
      return true;
    }),
  body('category').optional().isString().trim(),
  body('images').optional().isArray().withMessage('Images must be an array of strings'),
  body('images.*').optional().isString().withMessage('Image item must be a string'),
  body('imageUrl').optional().isString().trim(),
  body('openDays').optional().isArray().withMessage('openDays must be an array of numbers (0-6)'),
  body('openDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each open day must be 0-6'),
  body('operatingHours')
    .optional()
    .custom((val) => {
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const entry = val[i];
          if (!entry) continue;
          if (entry.dayOfWeek !== undefined && (entry.dayOfWeek < 0 || entry.dayOfWeek > 6)) {
            throw new Error(`dayOfWeek must be between 0 and 6 at index ${i}`);
          }
          if (entry.openTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(entry.openTime)) {
            throw new Error(`Invalid operating open time format (HH:MM) at index ${i}`);
          }
          if (entry.closeTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(entry.closeTime)) {
            throw new Error(`Invalid operating close time format (HH:MM) at index ${i}`);
          }
          if (entry.isOpen !== false && entry.openTime && entry.closeTime) {
            const [openH, openM] = entry.openTime.split(':').map(Number);
            const [closeH, closeM] = entry.closeTime.split(':').map(Number);
            if (openH * 60 + openM >= closeH * 60 + closeM) {
              throw new Error(`closeTime (${entry.closeTime}) must be after openTime (${entry.openTime}) on day ${entry.dayOfWeek ?? i}`);
            }
          }
        }
        return true;
      } else if (typeof val === 'object' && val !== null) {
        if (val.openTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(val.openTime)) {
          throw new Error('Invalid operating open time format (HH:MM)');
        }
        if (val.closeTime && !/^([01]\d|2[0-3]):?([0-5]\d)$/.test(val.closeTime)) {
          throw new Error('Invalid operating close time format (HH:MM)');
        }
        if (val.openTime && val.closeTime) {
          const [openH, openM] = val.openTime.split(':').map(Number);
          const [closeH, closeM] = val.closeTime.split(':').map(Number);
          if (openH * 60 + openM >= closeH * 60 + closeM) {
            throw new Error(`closeTime (${val.closeTime}) must be after openTime (${val.openTime})`);
          }
        }
        return true;
      }
      throw new Error('operatingHours must be an array of schedule objects');
    }),
  body('minNoticeHours').optional().isInt({ min: 0 }).withMessage('minNoticeHours must be a non-negative integer'),
  body('advanceBookingDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('advanceBookingDays must be an integer >= 1'),
  body('maxAdvanceBookingDays')
    .optional()
    .isInt({ min: 0 })
    .withMessage('maxAdvanceBookingDays must be a non-negative integer'),
  body('maxCapacity').optional().isInt({ min: 1 }).withMessage('maxCapacity must be at least 1'),
  body('maxHeadcountPerReservation')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxHeadcountPerReservation must be at least 1'),
  body('setupBufferMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('setupBufferMinutes must be a non-negative integer'),
  body('slotDurationMinutes')
    .optional()
    .isInt({ min: 15 })
    .withMessage('slotDurationMinutes must be at least 15 minutes'),
  body('isMultiResourceFacility').optional().isBoolean().withMessage('isMultiResourceFacility must be a boolean'),
  body('subRooms').optional().isArray().withMessage('subRooms must be an array'),
  body('subRooms.*.name').optional().isString().trim().notEmpty().withMessage('Sub-room name cannot be empty'),
  body('subRooms.*.capacity').optional().isInt({ min: 1 }).withMessage('Sub-room capacity must be at least 1'),
  body('roomAmenities').optional().isArray().withMessage('roomAmenities must be an array of strings'),
  body('availableStock').optional().isInt({ min: 0 }).withMessage('availableStock cannot be negative'),
  body('maxLoanHours').optional().isInt({ min: 1 }).withMessage('maxLoanHours must be at least 1'),
  body('requiresInspection').optional().isBoolean().withMessage('requiresInspection must be a boolean'),
  body('bookingMode').optional().isIn(['FULL_DAY', 'SESSION', 'HOURLY']).withMessage('bookingMode must be FULL_DAY, SESSION or HOURLY'),
  body('sessions').optional().isArray().withMessage('sessions must be an array'),
  body('sessions.*.name').optional().isString().trim().notEmpty().withMessage('Session name cannot be empty'),
  body('sessions.*.startTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Session startTime must be HH:MM'),
  body('sessions.*.endTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Session endTime must be HH:MM'),
  body('sessions.*.price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Session price cannot be negative'),
  body('stayMode').optional().isIn(['HOURLY', 'OVERNIGHT']).withMessage('stayMode must be HOURLY or OVERNIGHT'),
  body('checkInTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('checkInTime must be HH:MM'),
  body('checkOutTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('checkOutTime must be HH:MM'),
  body('maxNights').optional().isInt({ min: 1 }).withMessage('maxNights must be at least 1'),
  body('pricingConfig.pricingType')
    .optional()
    .isIn(['FREE', 'HOURLY', 'DAILY', 'FIXED_EVENT', 'TIERED'])
    .withMessage('Invalid pricingType'),
  body('pricingConfig.baseRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('baseRate must be a non-negative number'),
  body('pricingConfig.taxPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('taxPercentage must be between 0 and 100'),
  body('pricingConfig.securityDeposit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('securityDeposit must be a non-negative number'),
  body('pricingConfig.currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('currency must be 3-letter code'),
  body('cancellationPolicy.isAllowed')
    .optional()
    .isBoolean()
    .withMessage('isAllowed must be a boolean'),
  body('cancellationPolicy.refundCutoffHours')
    .optional()
    .isInt({ min: 0 })
    .withMessage('refundCutoffHours must be a non-negative integer'),
  body('cancellationPolicy.refundPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('refundPercentage must be between 0 and 100'),
  body('requiresApproval').optional().isBoolean().withMessage('requiresApproval must be a boolean'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'])
    .withMessage('Invalid facility status'),
  body('isDraft').optional().isBoolean().withMessage('isDraft must be a boolean'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const facilityIdParamRules = [
  param('facilityId').notEmpty().withMessage('Facility ID parameter is required').isMongoId().withMessage('Invalid Facility ID'),
];

export const facilityCodeParamRules = [
  param('code').notEmpty().withMessage('Facility code parameter is required').isString().trim(),
];

export const listFacilitiesRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim(),
  query('archetype')
    .optional()
    .isIn(['SHARED_CAPACITY', 'EXCLUSIVE_HOURLY', 'EVENT_SPACE', 'ROOM_RESOURCE', 'INVENTORY_TOOLS'])
    .withMessage('Invalid archetype filter'),
  query('status')
    .optional()
    .isIn(['ALL', 'DRAFT', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'])
    .withMessage('Invalid status filter'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('isDraft').optional().isBoolean().withMessage('isDraft must be a boolean'),
];
