import { Router } from 'express';
import amenitySettingsController from './amenitySettings.controller.js';
import { updateAmenitySettingsRules } from './amenitySettings.validateRules.js';
import validate from '../../../middlewares/validator.middleware.js';
import isAuthenticated from '../../../middlewares/auth.middleware.js';
import tenantContext from '../../../middlewares/tenant.middleware.js';
import authorizePermission from '../../../middlewares/rbac.middleware.js';

const router = Router();

router.use(isAuthenticated, tenantContext);

// Readable by anyone who books or runs amenities (the booking UI shows these rules).
router.get(
  '/',
  authorizePermission('amenities', ['settings', 'amenities', 'discover', 'my_booking', 'admin_calander', 'scanner']),
  amenitySettingsController.get
);

router.put('/', authorizePermission('amenities', ['settings']), validate(updateAmenitySettingsRules), amenitySettingsController.update);

export default router;
