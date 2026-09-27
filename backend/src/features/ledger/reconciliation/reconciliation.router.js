import { Router } from 'express';
import reconciliationController from './reconciliation.controller.js';
import { isAuthenticated } from '../../../middlewares/auth.middleware.js';

const router = Router();

// Administrative reconciliation routes
router.get('/inventory', isAuthenticated, reconciliationController.getInventory);
router.post('/run', isAuthenticated, reconciliationController.runReconciliation);
router.get('/verify', isAuthenticated, reconciliationController.verifyInvariants);
router.get('/integrity', isAuthenticated, reconciliationController.getIntegrity);
router.get('/metrics', isAuthenticated, reconciliationController.getMetrics);
router.get('/reports/:runId', isAuthenticated, reconciliationController.getRunReport);
router.get('/exceptions', isAuthenticated, reconciliationController.getExceptions);
router.patch('/exceptions/:exceptionId', isAuthenticated, reconciliationController.updateException);

export default router;
