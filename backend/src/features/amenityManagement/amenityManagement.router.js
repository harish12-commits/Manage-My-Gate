import { Router } from 'express';
import facilityRouter from './facilities/amenityFacility.router.js';
import resourceRouter from './resources/amenityResource.router.js';
import availabilityRouter from './domain/availability/availability.router.js';
import pricingRouter from './domain/pricing/pricing.router.js';
import holdRouter from './holds/amenityReservationHold.router.js';
import reservationRouter from './reservations/amenityReservation.router.js';
import passRouter from './passes/amenityAccessPass.router.js';
import maintenanceRouter from './maintenance/amenityMaintenanceBlock.router.js';
import paymentRouter from './payments/amenityPayment.router.js';
import settingsRouter from './settings/amenitySettings.router.js';
import './payments/amenityPayment.listeners.js';

const router = Router();

router.use('/facilities', facilityRouter);
router.use('/resources', resourceRouter);
router.use('/availability', availabilityRouter);
router.use('/pricing', pricingRouter);
router.use('/holds', holdRouter);
router.use('/reservations', reservationRouter);
router.use('/passes', passRouter);
router.use('/maintenance', maintenanceRouter);
router.use('/payments', paymentRouter);
router.use('/settings', settingsRouter);

export default router;
