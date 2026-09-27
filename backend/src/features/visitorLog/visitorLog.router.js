import { Router } from 'express';
import visitorLogController from './visitorLog.controller.js';
import { validate } from '../../middlewares/validator.middleware.js';
import { preApprovedEntryRules, walkInRequestRules, resolveWalkInRules, checkoutRules } from './visitorLog.validator.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import tenantContext from '../../middlewares/tenant.middleware.js';

const router = Router();

router.use(isAuthenticated, tenantContext);

router.post('/pre-approved', validate(preApprovedEntryRules), visitorLogController.logPreApproved);
router.post('/walk-in', validate(walkInRequestRules), visitorLogController.initiateWalkIn);
router.patch('/walk-in/:id/resolve', validate(resolveWalkInRules), visitorLogController.resolveWalkIn);
router.patch('/:id/checkout', validate(checkoutRules), visitorLogController.checkout);
router.get('/org/:orgId/inside', visitorLogController.getInside);
router.get('/org/:orgId/pending', visitorLogController.getPending);
router.get('/org/:orgId', visitorLogController.getHistory);

export default router;
