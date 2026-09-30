import { Router } from 'express';
import issueReportController from './issueReport.controller.js';
import { upload, imageSignatureValidator } from './middlewares/upload.middleware.js';
import { validate } from '../../middlewares/validator.middleware.js';
import {
  createReportRules,
  queryPlatformReportsRules,
  getReportByIdRules,
  getAttachmentRules,
} from './issueReport.validator.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import tenantContext from '../../middlewares/tenant.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { reportSubmitLimiter } from '../../middlewares/rateLimiter.middleware.js';

// Primary router mounted at /support/reports
const router = Router();

/**
 * @route   POST /api/v1/support/reports
 * @desc    Submit an issue report (Resident / User within active workspace context)
 * @access  Private (Authenticated Active User + Tenant Context)
 */
router.post(
  '/',
  isAuthenticated,
  tenantContext(),
  reportSubmitLimiter,
  upload.single('screenshot'),
  imageSignatureValidator,
  validate(createReportRules),
  issueReportController.submitReport.bind(issueReportController)
);

/**
 * @route   GET /api/v1/support/reports/community
 * @desc    List issue reports for the authenticated tenant's Community Admin
 * @access  Private (Authenticated Active User + Tenant Context + Community Admin Role)
 */
router.get(
  '/community',
  isAuthenticated,
  tenantContext(),
  authorizeRoles('Admin', 'Community Admin', 'Facility Manager', 'Super Admin', 'Platform Admin', 'Platform Super Admin'),
  validate(queryPlatformReportsRules),
  issueReportController.getCommunityReports.bind(issueReportController)
);

/**
 * @route   GET /api/v1/support/reports/community/:id
 * @desc    Get detailed report view by MongoDB ID (Tenant Scoped)
 * @access  Private (Authenticated Active User + Tenant Context + Community Admin Role)
 */
router.get(
  '/community/:id',
  isAuthenticated,
  tenantContext(),
  authorizeRoles('Admin', 'Community Admin', 'Facility Manager', 'Super Admin', 'Platform Admin', 'Platform Super Admin'),
  validate(getReportByIdRules),
  issueReportController.getCommunityReportById.bind(issueReportController)
);

/**
 * @route   GET /api/v1/support/reports/attachments/:filename
 * @desc    Download a report screenshot (private; org-scoped for community admins, global for platform)
 * @access  Private (Authenticated Active User + Tenant Context + Admin Role)
 */
router.get(
  '/attachments/:filename',
  isAuthenticated,
  tenantContext(),
  authorizeRoles('Admin', 'Community Admin', 'Facility Manager', 'Super Admin', 'Platform Admin', 'Platform Super Admin'),
  validate(getAttachmentRules),
  issueReportController.getAttachment.bind(issueReportController)
);

// Platform Admin router mounted at /platform/reports
const platformReportRouter = Router();

/**
 * @route   GET /api/v1/platform/reports
 * @desc    List all system issue reports with pagination, filtering & search
 * @access  Private (Platform Super Admin only)
 */
platformReportRouter.get(
  '/',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  validate(queryPlatformReportsRules),
  issueReportController.getPlatformReports.bind(issueReportController)
);

/**
 * @route   GET /api/v1/platform/reports/:id
 * @desc    Get detailed report view by MongoDB ID
 * @access  Private (Platform Super Admin only)
 */
platformReportRouter.get(
  '/:id',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  validate(getReportByIdRules),
  issueReportController.getReportById.bind(issueReportController)
);

// Also expose platform endpoints on the root router for alternative routing flexibility
router.get(
  '/platform/reports',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  validate(queryPlatformReportsRules),
  issueReportController.getPlatformReports.bind(issueReportController)
);

router.get(
  '/platform/reports/:id',
  isAuthenticated,
  tenantContext({ requirePlatformContext: true }),
  validate(getReportByIdRules),
  issueReportController.getReportById.bind(issueReportController)
);

export { platformReportRouter };
export default router;
