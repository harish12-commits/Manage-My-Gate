import { Router } from 'express';
import amenityBookingController from './amenityBooking.controller.js';
import { validate } from '../../middlewares/validator.middleware.js';
import { createBookingRules, manualBookingRules } from './amenityBooking.validateRules.js';
import isAuthenticated from '../../middlewares/auth.middleware.js';
import { authorizePermission } from '../../middlewares/rbac.middleware.js';
import tenantContext from '../../middlewares/tenant.middleware.js';
import './amenityBooking.listeners.js';

const router = Router();

// Protect all routes
router.use(isAuthenticated, tenantContext);

// Resident facing routes
router.get('/my-bookings', authorizePermission('amenities', 'my_booking'), amenityBookingController.getMyBookings);
router.post('/', authorizePermission('amenities', 'my_booking'), validate(createBookingRules), amenityBookingController.createBooking);
router.put('/:id/cancel', authorizePermission('amenities', 'my_booking'), amenityBookingController.cancelBooking);

// Admin facing routes (Approval queue & manual booking)
router.get('/admin-calendar', authorizePermission('amenities', ['admin_calander', 'dashboard']), amenityBookingController.getAdminCalendar);
router.post('/manual', authorizePermission('amenities', ['dashboard', 'admin_calander']), validate(manualBookingRules), amenityBookingController.createManualBooking);
router.post('/:id/cash-payment', authorizePermission('amenities', ['dashboard', 'admin_calander', 'scanner']), amenityBookingController.recordCashPayment);
router.get('/queue', authorizePermission('amenities', ['dashboard', 'ledgers', 'admin_calander', 'amenities']), amenityBookingController.getQueue);

router.put('/:id/admin-cancel', authorizePermission('amenities', 'admin_calander'), amenityBookingController.adminCancelBooking);

// Analytics routes
router.get('/stats/dashboard', authorizePermission('amenities', 'dashboard'), amenityBookingController.getDashboardData);
router.get('/stats/kpi', authorizePermission('amenities', 'dashboard'), amenityBookingController.getKpiStats);
router.get('/stats/revenue', authorizePermission('amenities', 'dashboard'), amenityBookingController.getRevenueStats);
router.get('/stats/occupancy', authorizePermission('amenities', 'dashboard'), amenityBookingController.getOccupancyStats);
router.get('/stats/trends', authorizePermission('amenities', 'dashboard'), amenityBookingController.getTrendsStats);
router.get('/stats/recent-activity', authorizePermission('amenities', 'dashboard'), amenityBookingController.getRecentActivity);

// Scanner routes
router.get('/scans/recent', authorizePermission('amenities', 'scanner'), amenityBookingController.getRecentScans);
router.post('/:id/checkin', authorizePermission('amenities', 'scanner'), amenityBookingController.checkInBooking);

export default router;
