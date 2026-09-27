import mongoose from 'mongoose';
import HttpError from '../../../utils/httpError.utils.js';
import amenityReservationHoldRepository from './amenityReservationHold.repository.js';
import amenityFacilityRepository from '../facilities/amenityFacility.repository.js';
import amenityResourceRepository from '../resources/amenityResource.repository.js';
import amenitySlotAllocationRepository from '../allocations/amenitySlotAllocation.repository.js';
import amenityAllocationLedgerRepository from '../allocations/amenityAllocationLedger.repository.js';
import amenityOutboxEventRepository from '../outbox/amenityOutboxEvent.repository.js';
import amenityQuotaAllocationService from '../quotas/amenityQuotaAllocation.service.js';
import resourceMutexService from '../domain/concurrency/resourceMutex.service.js';
import availabilityService from '../domain/availability/availability.service.js';
import pricingService from '../domain/pricing/pricing.service.js';
import { withTransactionRetry } from '../domain/concurrency/transaction.utils.js';
import amenityManagementEvents, { AMENITY_EVENTS } from '../amenityManagement.events.js';

export class AmenityReservationHoldService {
  /**
   * Creates an ephemeral reservation hold document within an atomic transaction.
   * Acquires optimistic mutex, checks archetype availability, reserves quota,
   * allocates slots/buckets, and records allocation ledger entry.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.facilityId
   * @param {string|mongoose.Types.ObjectId} [params.resourceId]
   * @param {string|mongoose.Types.ObjectId} params.residentId
   * @param {string|mongoose.Types.ObjectId} params.unitId
   * @param {Date|string} params.requestedStartDateTime
   * @param {Date|string} params.requestedEndDateTime
   * @param {number} [params.headcount=1]
   * @param {number} [params.quantity=1]
   * @param {'STANDARD'|'ADMIN_REVIEW'|'PAYMENT_PENDING'} [params.holdType='STANDARD']
   * @param {number} [params.holdDurationMinutes=10]
   * @param {mongoose.ClientSession} [session]
   * @returns {Promise<{ hold: any, pricingSnapshot: any }>}
   */
  async createStandardHold(params, session) {
    if (session) {
      return this._executeCreateHold(params, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executeCreateHold(params, trxSession);
    });
  }

  /**
   * Internal implementation of hold creation within a transaction session.
   * @private
   */
  async _executeCreateHold(
    {
      orgId,
      facilityId,
      resourceId = null,
      residentId,
      unitId,
      requestedStartDateTime,
      requestedEndDateTime,
      headcount = 1,
      quantity = 1,
      holdType = 'STANDARD',
      holdDurationMinutes = 10,
      quotaLimit = null,
    },
    session
  ) {
    const start = new Date(requestedStartDateTime);
    const end = new Date(requestedEndDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new HttpError(400, 'Invalid reservation range: startDateTime must be earlier than endDateTime');
    }

    const GRACE_PERIOD_MS = 2 * 60 * 1000;
    if (start.getTime() + GRACE_PERIOD_MS < Date.now()) {
      throw new HttpError(400, 'Reservation start time cannot be in the past');
    }

    // 1. Acquire Concurrency Mutex
    await resourceMutexService.acquireMutex({ orgId, facilityId, resourceId }, session);

    // 2. Verify Archetype-Aware Availability
    const avail = await availabilityService.checkAvailability(
      {
        orgId,
        facilityId,
        resourceId,
        startDateTime: start,
        endDateTime: end,
        requestedQuantity: quantity || headcount,
      },
      session
    );

    if (!avail.isAvailable) {
      throw new HttpError(409, avail.reason || 'Requested time slot or resource is not available');
    }

    const effectiveStart = avail.effectiveStartDateTime;
    const effectiveEnd = avail.effectiveEndDateTime;

    // 3. Facility Lookup
    const facility = await amenityFacilityRepository.findById(facilityId, orgId, session);
    if (!facility) {
      throw new HttpError(404, 'Amenity facility not found');
    }
    if (!facility.isActive || facility.isDraft || facility.status === 'DRAFT' || facility.status === 'INACTIVE') {
      throw new HttpError(400, 'Amenity facility is a draft or not active for reservations');
    }

    // 4. Reserve Household Quota
    const requestedUnits = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
    const effectiveQuotaLimit =
      Number(quotaLimit) ||
      (facility.archetype === 'ROOM_RESOURCE' ? Math.max(10080, requestedUnits) : 2400);
    await amenityQuotaAllocationService.reserveQuota(
      {
        orgId,
        unitId,
        facilityId,
        quotaLimit: effectiveQuotaLimit,
        requestedUnits,
        date: start,
      },
      session
    );

    // 5. Compute Commercial Pricing Snapshot
    const pricingSnapshot = pricingService.calculatePricingSnapshot({
      pricingConfig: facility.pricingConfig || facility.pricing,
      startDateTime: start,
      endDateTime: end,
      headcount,
      quantity,
    });

    // 6. Create Hold Document
    const expiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);
    const hold = await amenityReservationHoldRepository.create(
      {
        orgId,
        facilityId,
        resourceId: resourceId || null,
        residentId,
        unitId,
        requestedStartDateTime: start,
        requestedEndDateTime: end,
        effectiveStartDateTime: effectiveStart,
        effectiveEndDateTime: effectiveEnd,
        headcount,
        quantity,
        holdType,
        status: 'ACTIVE',
        expiresAt,
        pricingSnapshot,
      },
      session
    );

    // 7. Archetype-Specific Allocation & Ledger Record
    switch (facility.archetype) {
      case 'EXCLUSIVE_HOURLY': {
        const slotStartUTC = start.toISOString();
        const slotId = `SLOT:${orgId}:${facilityId}:${resourceId || 'ALL'}:${slotStartUTC}`;

        await amenitySlotAllocationRepository.createDiscreteSlot(
          {
            _id: slotId,
            orgId,
            facilityId,
            resourceId,
            allocationType: 'EXCLUSIVE_DISCRETE',
            slotStartDateTime: start,
            slotEndDateTime: end,
            status: 'HELD',
            holdId: hold._id,
            expiresAt,
            version: 1,
          },
          session
        );
        break;
      }

      case 'SHARED_CAPACITY': {
        const slotStartUTC = start.toISOString();
        const bucketId = `BUCKET:${orgId}:${facilityId}:${slotStartUTC}`;

        const bucket = await amenitySlotAllocationRepository.allocateCapacityBucket(
          {
            bucketId,
            orgId,
            facilityId,
            slotStartDateTime: start,
            slotEndDateTime: end,
            requestedHeadcount: headcount,
            maxCapacity: facility.maxCapacity || 10,
          },
          session
        );

        if (!bucket) {
          throw new HttpError(409, 'Capacity exceeded for requested timeslot');
        }

        await amenityAllocationLedgerRepository.createEntry(
          {
            orgId,
            facilityId,
            holdId: hold._id,
            allocationType: 'CAPACITY_HEADCOUNT',
            bucketId,
            allocatedQuantity: headcount,
            status: 'HELD',
          },
          session
        );
        break;
      }

      case 'INVENTORY_TOOLS': {
        const resource = resourceId
          ? await amenityResourceRepository.findById(resourceId, orgId, session)
          : null;

        if (resource && !resource.isSerializedAsset) {
          const dateToken = start.toISOString().split('T')[0];
          const bucketId = `BULK:${orgId}:${facilityId}:${resourceId}:${dateToken}`;

          const bucket = await amenitySlotAllocationRepository.allocateBulkDayBucket(
            {
              bucketId,
              orgId,
              facilityId,
              resourceId,
              dateToken,
              requestedQty: quantity,
              totalStock: resource.totalBulkStock || 0,
            },
            session
          );

          if (!bucket) {
            throw new HttpError(409, 'Insufficient inventory stock for requested date');
          }

          await amenityAllocationLedgerRepository.createEntry(
            {
              orgId,
              facilityId,
              holdId: hold._id,
              allocationType: 'BULK_INVENTORY',
              bucketId,
              allocatedQuantity: quantity,
              status: 'HELD',
            },
            session
          );
        }
        break;
      }

      case 'EVENT_SPACE':
      case 'ROOM_RESOURCE':
      default:
        break;
    }

    // 8. Emit Domain Event
    amenityManagementEvents.emit(AMENITY_EVENTS.HOLD_CREATED, {
      holdId: hold._id,
      orgId,
      residentId,
      expiresAt,
    });

    return { hold, pricingSnapshot };
  }

  /**
   * Atomically expires an active hold, safely releasing capacity and quota.
   * State-guarded against double-release and idempotent.
   *
   * @param {string|mongoose.Types.ObjectId} holdId
   * @param {mongoose.ClientSession} [session]
   * @returns {Promise<any>}
   */
  async expireHold(holdId, session) {
    if (session) {
      return this._executeExpireHold(holdId, session);
    }
    return withTransactionRetry(async (trxSession) => {
      return this._executeExpireHold(holdId, trxSession);
    });
  }

  /**
   * Internal implementation of hold expiration.
   * @private
   */
  async _executeExpireHold(holdId, session) {
    // 1. State-guarded transition from ACTIVE -> EXPIRED
    const updatedHold = await amenityReservationHoldRepository.transitionStatus(
      { holdId, fromStatus: 'ACTIVE', toStatus: 'EXPIRED' },
      session
    );

    if (!updatedHold) {
      // Hold is already promoted, expired, or doesn't exist; idempotent exit
      return null;
    }

    // 2. Fetch and release all ledger entries for this hold
    const ledgerEntries = await amenityAllocationLedgerRepository.findByHoldId(holdId, session);

    for (const entry of ledgerEntries) {
      const released = await amenityAllocationLedgerRepository.transitionStatus(
        { holdId, fromStatus: 'HELD', toStatus: 'RELEASED' },
        session
      );

      if (released) {
        if (entry.allocationType === 'CAPACITY_HEADCOUNT' && entry.bucketId) {
          await amenitySlotAllocationRepository.decrementCapacityBucket(
            entry.bucketId,
            entry.allocatedQuantity,
            session
          );
        } else if (entry.allocationType === 'BULK_INVENTORY' && entry.bucketId) {
          await amenitySlotAllocationRepository.decrementBulkDayBucket(
            entry.bucketId,
            entry.allocatedQuantity,
            session
          );
        }
      }
    }

    // Release discrete slot if held
    const slotStartUTC = updatedHold.requestedStartDateTime.toISOString();
    const slotId = `SLOT:${updatedHold.orgId}:${updatedHold.facilityId}:${updatedHold.resourceId || 'ALL'}:${slotStartUTC}`;
    await amenitySlotAllocationRepository.releaseDiscreteSlot(slotId, session);

    // 3. Release Reserved Quota
    const requestedUnits = Math.ceil(
      (updatedHold.effectiveEndDateTime.getTime() - updatedHold.effectiveStartDateTime.getTime()) /
        (1000 * 60)
    );

    await amenityQuotaAllocationService.releaseQuota(
      {
        orgId: updatedHold.orgId,
        unitId: updatedHold.unitId,
        facilityId: updatedHold.facilityId,
        requestedUnits,
        date: updatedHold.requestedStartDateTime,
      },
      session
    );

    // 4. Record Transactional Outbox Event
    await amenityOutboxEventRepository.createEvent(
      {
        orgId: updatedHold.orgId,
        eventType: 'HOLD_EXPIRED',
        aggregateId: updatedHold._id,
        aggregateType: 'AmenityReservationHold',
        payload: {
          holdId: updatedHold._id,
          orgId: updatedHold.orgId,
          residentId: updatedHold.residentId,
        },
      },
      session
    );

    // 5. Emit Application Domain Event
    amenityManagementEvents.emit(AMENITY_EVENTS.HOLD_EXPIRED, {
      holdId: updatedHold._id,
      orgId: updatedHold.orgId,
      residentId: updatedHold.residentId,
      status: 'EXPIRED',
    });

    return updatedHold;
  }

  /**
   * Scans and expires stale active holds.
   * Useful for background worker or fallback sweepers.
   * @param {number} [limit=50]
   */
  async expireStaleActiveHolds(limit = 50) {
    const expiredHolds = await amenityReservationHoldRepository.findExpiredActiveHolds(limit);
    const results = [];
    for (const hold of expiredHolds) {
      try {
        const res = await this.expireHold(hold._id);
        if (res) results.push(res);
      } catch (err) {
        // Individual hold failures should not crash batch run
      }
    }
    return results;
  }

  /**
   * Finds hold by ID.
   * @param {string|mongoose.Types.ObjectId} holdId
   * @param {mongoose.ClientSession} [session]
   */
  async getHoldById(holdId, session) {
    return amenityReservationHoldRepository.findById(holdId, session);
  }

  /**
   * Finds active hold by ID.
   * @param {string|mongoose.Types.ObjectId} holdId
   * @param {mongoose.ClientSession} [session]
   */
  async getActiveHoldById(holdId, session) {
    return amenityReservationHoldRepository.findActiveById(holdId, session);
  }
}

export const amenityReservationHoldService = new AmenityReservationHoldService();
export default amenityReservationHoldService;
