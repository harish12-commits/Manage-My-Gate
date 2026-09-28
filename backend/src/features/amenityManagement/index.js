// ==========================================
// 12 Mongoose Models
// ==========================================
export { AmenityFacility } from './facilities/amenityFacility.model.js';
export { AmenityResource } from './resources/amenityResource.model.js';
export { AmenitySlotAllocation } from './allocations/amenitySlotAllocation.model.js';
export { AmenityAllocationLedger } from './allocations/amenityAllocationLedger.model.js';
export { AmenityReservationHold } from './holds/amenityReservationHold.model.js';
export { AmenityReservation } from './reservations/amenityReservation.model.js';
export { AmenityQuotaAllocation } from './quotas/amenityQuotaAllocation.model.js';
export { AmenityAccessPass } from './passes/amenityAccessPass.model.js';
export { AmenityMaintenanceBlock } from './maintenance/amenityMaintenanceBlock.model.js';
export { AmenityOutboxEvent } from './outbox/amenityOutboxEvent.model.js';
export { AmenityIdempotencyRecord } from './idempotency/amenityIdempotencyRecord.model.js';
export { AmenityCounter } from './counters/amenityCounter.model.js';

// ==========================================
// 12 Repositories
// ==========================================
export {
  AmenityFacilityRepository,
  amenityFacilityRepository,
} from './facilities/amenityFacility.repository.js';
export {
  AmenityResourceRepository,
  amenityResourceRepository,
} from './resources/amenityResource.repository.js';
export {
  AmenitySlotAllocationRepository,
  amenitySlotAllocationRepository,
} from './allocations/amenitySlotAllocation.repository.js';
export {
  AmenityAllocationLedgerRepository,
  amenityAllocationLedgerRepository,
} from './allocations/amenityAllocationLedger.repository.js';
export {
  AmenityReservationHoldRepository,
  amenityReservationHoldRepository,
} from './holds/amenityReservationHold.repository.js';
export {
  AmenityReservationRepository,
  amenityReservationRepository,
} from './reservations/amenityReservation.repository.js';
export {
  AmenityQuotaAllocationRepository,
  amenityQuotaAllocationRepository,
} from './quotas/amenityQuotaAllocation.repository.js';
export {
  AmenityAccessPassRepository,
  amenityAccessPassRepository,
} from './passes/amenityAccessPass.repository.js';
export {
  AmenityMaintenanceBlockRepository,
  amenityMaintenanceBlockRepository,
} from './maintenance/amenityMaintenanceBlock.repository.js';
export {
  AmenityOutboxEventRepository,
  amenityOutboxEventRepository,
} from './outbox/amenityOutboxEvent.repository.js';
export {
  AmenityIdempotencyRecordRepository,
  amenityIdempotencyRecordRepository,
} from './idempotency/amenityIdempotencyRecord.repository.js';
export {
  AmenityCounterRepository,
  amenityCounterRepository,
} from './counters/amenityCounter.repository.js';

// ==========================================
// Feature & Domain Services
// ==========================================
export {
  AmenityFacilityService,
  amenityFacilityService,
} from './facilities/amenityFacility.service.js';
export {
  AmenityResourceService,
  amenityResourceService,
} from './resources/amenityResource.service.js';
export {
  AmenityReservationHoldService,
  amenityReservationHoldService,
} from './holds/amenityReservationHold.service.js';
export {
  AmenityReservationService,
  amenityReservationService,
} from './reservations/amenityReservation.service.js';
export {
  AmenityAccessPassService,
  amenityAccessPassService,
} from './passes/amenityAccessPass.service.js';
export {
  AmenityQuotaAllocationService,
  amenityQuotaAllocationService,
} from './quotas/amenityQuotaAllocation.service.js';
export {
  AmenityMaintenanceBlockService,
  amenityMaintenanceBlockService,
} from './maintenance/amenityMaintenanceBlock.service.js';
export {
  AmenityCounterService,
  amenityCounterService,
} from './counters/amenityCounter.service.js';
export {
  AmenityIdempotencyService,
  amenityIdempotencyService,
} from './idempotency/amenityIdempotencyRecord.service.js';

// Domain Core Services & Concurrency Utilities
export {
  AvailabilityService,
  availabilityService,
} from './domain/availability/availability.service.js';
export {
  PricingService,
  pricingService,
} from './domain/pricing/pricing.service.js';
export {
  ResourceMutexService,
  resourceMutexService,
} from './domain/concurrency/resourceMutex.service.js';
export {
  withTransaction,
  withTransactionRetry,
} from './domain/concurrency/transaction.utils.js';
export {
  AmenityEffectiveStateService,
  amenityEffectiveStateService,
} from './domain/effectiveState/amenityEffectiveState.service.js';

// Events & Real-time Sockets
export {
  AMENITY_EVENTS,
  amenityManagementEvents,
} from './amenityManagement.events.js';
export {
  AmenityManagementSocket,
  amenityManagementSocket,
} from './amenityManagement.socket.js';

// Routers
export { default as amenityManagementRouter } from './amenityManagement.router.js';
export { default as amenityFacilityRouter } from './facilities/amenityFacility.router.js';
export { default as amenityResourceRouter } from './resources/amenityResource.router.js';
export { default as availabilityRouter } from './domain/availability/availability.router.js';
export { default as pricingRouter } from './domain/pricing/pricing.router.js';
export { default as amenityReservationHoldRouter } from './holds/amenityReservationHold.router.js';
export { default as amenityReservationRouter } from './reservations/amenityReservation.router.js';
export { default as amenityAccessPassRouter } from './passes/amenityAccessPass.router.js';
export { default as amenityMaintenanceBlockRouter } from './maintenance/amenityMaintenanceBlock.router.js';
export { default as amenityPaymentRouter } from './payments/amenityPayment.router.js';

// Controllers
export {
  AmenityFacilityController,
  amenityFacilityController,
} from './facilities/amenityFacility.controller.js';
export {
  AmenityResourceController,
  amenityResourceController,
} from './resources/amenityResource.controller.js';
export {
  AvailabilityController,
  availabilityController,
} from './domain/availability/availability.controller.js';
export {
  PricingController,
  pricingController,
} from './domain/pricing/pricing.controller.js';
export {
  AmenityReservationHoldController,
  amenityReservationHoldController,
} from './holds/amenityReservationHold.controller.js';
export {
  AmenityReservationController,
  amenityReservationController,
} from './reservations/amenityReservation.controller.js';
export {
  AmenityAccessPassController,
  amenityAccessPassController,
} from './passes/amenityAccessPass.controller.js';
export {
  AmenityMaintenanceBlockController,
  amenityMaintenanceBlockController,
} from './maintenance/amenityMaintenanceBlock.controller.js';
export {
  AmenityPaymentController,
  amenityPaymentController,
} from './payments/amenityPayment.controller.js';

// ==========================================
// Workers & Operational Infrastructure (Phase 4D)
// ==========================================
export {
  AmenityOutboxService,
  amenityOutboxService,
} from './outbox/amenityOutbox.service.js';
export {
  AmenityHoldExpirationWorker,
  amenityHoldExpirationWorker,
} from './workers/amenityHoldExpiration.worker.js';
export {
  AmenityOutboxWorker,
  amenityOutboxWorker,
} from './workers/amenityOutbox.worker.js';
export {
  AmenityReservationLifecycleWorker,
  amenityReservationLifecycleWorker,
} from './workers/amenityReservationLifecycle.worker.js';
export { AMENITY_WORKER_CONFIG } from './config/amenityWorker.config.js';

