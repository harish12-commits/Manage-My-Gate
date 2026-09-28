import { Router } from 'express';
import { getLogs, getDashboardStats, manualVerification, deleteLog } from './securityLog.controller.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import { authorizePermission } from '../../middlewares/rbac.middleware.js';
import tenantContext from '../../middlewares/tenant.middleware.js';

const router = Router();

// Protect all routes
router.use(isAuthenticated, tenantContext);

// Dashboard stats - admins & guards
router.get('/dashboard', authorizePermission('amenities', ['security_logs', 'scanner', 'amenities', 'dashboard']), getDashboardStats);

// Manual verification log
router.post('/manual', authorizePermission('amenities', ['scanner', 'amenities', 'security_logs']), manualVerification);

// List security logs with filters
router.get('/', authorizePermission('amenities', ['security_logs', 'scanner', 'amenities', 'dashboard']), getLogs);

// Delete security log: an audit record, so only amenity administrators may remove one
// (never gate staff, whose own actions the log records).
router.delete('/:id', authorizePermission('amenities', ['dashboard']), deleteLog);

export default router;
