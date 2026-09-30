import { Router } from 'express';
import issueReportConfigController from './issueReportConfig.controller.js';
import { updateConfigRules } from './issueReportConfig.validator.js';
import { validate } from '../../middlewares/validator.middleware.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import tenantContext from '../../middlewares/tenant.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';

const router = Router();

/**
 * @route   GET /api/v1/platform/reports/config
 * @desc    Get Platform Admin issue report notification email configuration
 * @access  Private (Platform Admin only)
 */
router.get(
  '/',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  authorizeRoles('Super Admin', 'Platform Admin', 'Platform Super Admin'),
  issueReportConfigController.getConfig.bind(issueReportConfigController)
);

/**
 * @route   PUT /api/v1/platform/reports/config
 * @desc    Update Platform Admin issue report notification email configuration
 * @access  Private (Platform Admin only)
 */
router.put(
  '/',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  authorizeRoles('Super Admin', 'Platform Admin', 'Platform Super Admin'),
  validate(updateConfigRules),
  issueReportConfigController.updateConfig.bind(issueReportConfigController)
);

/**
 * @route   POST /api/v1/platform/reports/config/test-email
 * @desc    Send a test email to verify SMTP configuration
 * @access  Private (Platform Admin only)
 */
router.post(
  '/test-email',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  authorizeRoles('Super Admin', 'Platform Admin', 'Platform Super Admin'),
  issueReportConfigController.sendTestEmail.bind(issueReportConfigController)
);

export default router;
