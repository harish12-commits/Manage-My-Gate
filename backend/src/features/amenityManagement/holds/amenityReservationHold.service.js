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
import { getProfile, bookingRuleError } from '../domain/profiles/facilityProfiles.js';

/**
 * Monthly household quota in minutes until community settings own it (P2b).
 * Long-duration archetypes (stays, loans, events) get a month-sized allowance.
 */
const defaultQuotaMinutes = (facility, requestedUnits) => {
  const longDuration = ['ROOM_RESOURCE', 'INVENTORY_TOOLS', 'EVENT_SPACE'].includes(facility.archetype);
  return Math.max(longDuration ? 43200 : 2400, requestedUnits);
};
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
    },
    session
  ) {
    const start = new Date(requestedStartDateTime);
    const end = new Date(requestedEndDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new HttpError(400, 'Invalid reservation range: startDateTime must be earlier than endDateTime');
    }
    const partySize = Math.max(1, Number(headcount) || 1);
    const units = Math.max(1, Number(quantity) || 1);

    // 1. Facility and target resource
    const facility = await amenityFacilityRepository.findById(facilityId, orgId, session);
    if (!facility) {
      throw new HttpError(404, 'Amenity facility not found');
    }
    if (!facility.isActive || facility.isDraft || ['DRAFT', 'INACTIVE', 'MAINTENANCE'].includes(facility.status)) {
      throw new HttpError(400, 'Amenity facility is a draft or not active for reservations');
    }

    const profile = getProfile(facility);
    let resource = null;
    let targetResourceId = resourceId || null;
    if (!targetResourceId && profile.requiresResource) {
      // A facility with a single bookable unit (e.g. one tool kit) needs no explicit pick.
      const active = await amenityResourceRepository.findActiveByFacilityId(facilityId, orgId, session);
      if (active.length === 1) targetResourceId = active[0]._id;
    }
    if (targetResourceId) {
      resource = await amenityResourceRepository.findById(targetResourceId, orgId, session);
      if (!resource || !resource.isActive || resource.isDeleted || String(resource.facilityId) !== String(facility._id)) {
        throw new HttpError(400, 'Selected room or item is not available for booking');
      }
    }

    // 2. Booking rules (notice, advance window, schedule shape, party size)
    const ruleError = bookingRuleError(facility, { start, end, headcount: partySize, quantity: units, resource });
    if (ruleError) {
      throw new HttpError(400, ruleError);
    }

    // 3. Serialize every hold on this facility, then check occupancy inside the transaction
    await resourceMutexService.acquireMutex({ orgId, facilityId }, session);
    const avail = await availabilityService.checkAvailability(
      {
        orgId,
        facilityId,
        resourceId: targetResourceId,
        startDateTime: start,
        endDateTime: end,
        headcount: partySize,
        quantity: units,
        enforceRules: false,
      },
      session
    );
    if (!avail.isAvailable) {
      throw new HttpError(409, avail.reason || 'Requested time slot or resource is not available');
    }

    // 4. Reserve household quota (minutes of the requested window)
    const requestedUnits = Math.ceil((end.getTime() - start.getTime()) / 60000);
    await amenityQuotaAllocationService.reserveQuota(
      {
        orgId,
        unitId,
        facilityId,
        quotaLimit: defaultQuotaMinutes(facility, requestedUnits),
        requestedUnits,
        date: start,
      },
      session
    );

    // 5. Price quoted now is the price held for the resident
    const pricingSnapshot = pricingService.calculateForFacility(facility, {
      startDateTime: start,
      endDateTime: end,
      headcount: partySize,
      quantity: units,
    });

    // 6. The hold itself is the allocation: occupancy is derived from active holds
    //    and reservations, so expiry/cancellation frees capacity automatically.
    const expiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);
    const hold = await amenityReservationHoldRepository.create(
      {
        orgId,
        facilityId,
        resourceId: targetResourceId,
        residentId,
        unitId,
        requestedStartDateTime: start,
        requestedEndDateTime: end,
        effectiveStartDateTime: avail.effectiveStartDateTime,
        effectiveEndDateTime: avail.effectiveEndDateTime,
        headcount: partySize,
        quantity: units,
        holdType,
        status: 'ACTIVE',
        expiresAt,
        pricingSnapshot,
      },
      session
    );

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
      (updatedHold.requestedEndDateTime.getTime() - updatedHold.requestedStartDateTime.getTime()) / 60000
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
