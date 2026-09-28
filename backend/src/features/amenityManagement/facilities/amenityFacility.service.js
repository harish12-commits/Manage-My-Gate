import mongoose from 'mongoose';
import HttpError from '../../../utils/httpError.utils.js';
import amenityFacilityRepository from './amenityFacility.repository.js';
import amenityResourceService from '../resources/amenityResource.service.js';
import amenityReservationService from '../reservations/amenityReservation.service.js';
import amenityManagementEvents, { AMENITY_EVENTS } from '../amenityManagement.events.js';
import amenityOutboxEventRepository from '../outbox/amenityOutboxEvent.repository.js';
import { withTransactionRetry } from '../domain/concurrency/transaction.utils.js';

function toLegacyAmenityDoc(f) {
  const pConfig = f.pricingConfig || {};
  return {
    _id: f._id,
    orgId: f.orgId,
    name: f.name,
    description: f.description || '',
    type:
      f.archetype === 'EXCLUSIVE_HOURLY'
        ? 'sports'
        : f.archetype === 'SHARED_CAPACITY'
          ? 'pool'
          : f.archetype === 'EVENT_SPACE'
            ? 'hall'
            : 'general',
    category: f.category || 'General',
    archetype: f.archetype,
    code: f.code,
    location: f.location || '',
    pricing: {
      baseRate: pConfig.baseRate || 0,
      pricingType: (pConfig.pricingType || 'FREE').toLowerCase(),
      peakRateMultiplier: 1,
      weekendRateMultiplier: 1,
      holidayRateMultiplier: 1,
      securityDeposit: pConfig.securityDeposit || 0,
      securityDepositDescription:
        (pConfig.securityDeposit || 0) > 0 ? 'Refundable deposit against equipment damages.' : null,
      taxPercentage: pConfig.taxPercentage || 0,
      cancellationChargePercentage: 0,
      dynamicPricingEnabled: false,
    },
    openDays: [0, 1, 2, 3, 4, 5, 6],
    capacity: f.maxCapacity || 1,
    bookingRules: {
      slotDurationMinutes: f.slotDurationMinutes || 60,
      bufferTimeMinutes: f.setupBufferMinutes || 10,
      openTime: f.operatingHours?.[0]?.openTime || '06:00',
      closeTime: f.operatingHours?.[0]?.closeTime || '22:00',
      maxBookingsPerUserPerSlot: f.maxHeadcountPerReservation || 2,
      advanceBookingDays: f.advanceBookingDays || 7,
      minAdvanceBookingHours: 1,
      isCancellationEnabled: f.cancellationPolicy?.isAllowed !== false,
      holidayCalendarIds: [],
      weeklyOffDays: [],
      cancellationRefundRules: [],
    },
    status: (f.status || 'ACTIVE').toLowerCase(),
    isDeleted: Boolean(f.isDeleted),
    maintenanceSchedules: [],
    createdAt: f.createdAt || new Date(),
    updatedAt: f.updatedAt || new Date(),
  };
}

export class AmenityFacilityService {
  /**
   * Synchronizes child AmenityResource records for ROOM_RESOURCE sub-rooms within a session.
   *
   * @param {Object} facility
   * @param {Array} subRooms
   * @param {import('mongoose').ClientSession} session
   * @private
   */
  async _syncSubRooms(facility, subRooms, session) {
    if (!Array.isArray(subRooms) || facility.archetype !== 'ROOM_RESOURCE') {
      return;
    }

    const existing = await amenityResourceService.getAllResourcesByFacilityId(
      facility._id,
      facility.orgId,
      session
    );
    const existingMap = new Map();
    for (const res of existing) {
      existingMap.set(res.identifier, res);
      existingMap.set(res.name.toLowerCase(), res);
    }

    const processedIds = new Set();

    for (let i = 0; i < subRooms.length; i++) {
      const room = subRooms[i];
      if (!room || !room.name) continue;
      const cleanName = room.name.trim();
      const identifier = room.id
        ? `${facility.code}-${room.id.toUpperCase()}`
        : `${facility.code}-ROOM-${i + 1}`;

      const matched = existingMap.get(identifier) || existingMap.get(cleanName.toLowerCase());

      if (matched) {
        processedIds.add(matched._id.toString());
        await amenityResourceService.updateResource(
          matched._id,
          facility.orgId,
          {
            name: cleanName,
            totalBulkStock: room.capacity || 1,
            isActive: room.isActive !== undefined ? room.isActive : !facility.isDraft,
          },
          session
        );
      } else {
        const created = await amenityResourceService.createResource(
          {
            orgId: facility.orgId,
            facilityId: facility._id,
            name: cleanName,
            identifier,
            totalBulkStock: room.capacity || 1,
            isActive: room.isActive !== undefined ? room.isActive : !facility.isDraft,
          },
          session
        );
        processedIds.add(created._id.toString());
        existingMap.set(identifier, created);
        existingMap.set(cleanName.toLowerCase(), created);
      }
    }

    // Soft-delete removed sub-rooms
    for (const res of existing) {
      if (!processedIds.has(res._id.toString())) {
        await amenityResourceService.softDeleteResource(res._id, facility.orgId, session);
      }
    }
  }

  /**
   * Creates a new amenity facility document.
   * Enforces unique uppercase facility code within tenant organization.
   * Atomically provisions child sub-rooms if ROOM_RESOURCE archetype.
   *
   * @param {Object} facilityData
   * @param {import('mongoose').ClientSession} [session]
   */
  async createFacility(facilityData, session) {
    if (!facilityData.orgId || !facilityData.name || !facilityData.code || !facilityData.archetype) {
      throw new HttpError(400, 'orgId, name, code, and archetype are required to create a facility');
    }

    const normalizedCode = facilityData.code.trim().toUpperCase();
    const isDraft = Boolean(facilityData.isDraft === true || facilityData.status === 'DRAFT');
    const status = isDraft ? 'DRAFT' : (facilityData.status || 'ACTIVE');
    const isActive = isDraft ? false : (facilityData.isActive !== false);

    // If published upon creation, validate minimum required configuration
    if (!isDraft) {
      if (
        !facilityData.location ||
        typeof facilityData.location !== 'string' ||
        !facilityData.location.trim()
      ) {
        throw new HttpError(400, 'Cannot publish facility: location is required');
      }
      if (
        !facilityData.operatingHours ||
        !facilityData.operatingHours.length ||
        !facilityData.slotDurationMinutes
      ) {
        throw new HttpError(
          400,
          'Cannot publish facility: operatingHours and slotDurationMinutes are required'
        );
      }
    }

    const payload = {
      ...facilityData,
      code: normalizedCode,
      isDraft,
      status,
      isActive,
    };

    const executeCreate = async (trxSession) => {
      const existing = await amenityFacilityRepository.findByCode(
        payload.orgId,
        normalizedCode,
        trxSession
      );

      if (existing) {
        throw new HttpError(409, `Facility with code '${normalizedCode}' already exists in this organization`);
      }

      const facility = await amenityFacilityRepository.create(payload, trxSession);

      if (payload.archetype === 'ROOM_RESOURCE' && Array.isArray(payload.subRooms) && payload.subRooms.length > 0) {
        await this._syncSubRooms(facility, payload.subRooms, trxSession);
      } else if (payload.archetype === 'INVENTORY_TOOLS') {
        const identifier = `${facility.code}-ITEM-01`;
        await amenityResourceService.createResource(
          {
            orgId: facility.orgId,
            facilityId: facility._id,
            name: facility.name,
            identifier,
            totalBulkStock: facility.availableStock || facility.capacity || 1,
            isSerializedAsset: false,
            assetState: 'AVAILABLE',
            isActive: !facility.isDraft,
          },
          trxSession
        );
      }

      // Record Transactional Outbox Event
      await amenityOutboxEventRepository.createEvent(
        {
          orgId: facility.orgId,
          eventType: isDraft ? 'FACILITY_CREATED' : 'FACILITY_PUBLISHED',
          aggregateId: facility._id,
          aggregateType: 'AmenityFacility',
          payload: {
            facilityId: facility._id,
            code: facility.code,
            name: facility.name,
            isDraft: facility.isDraft,
            isActive: facility.isActive,
            status: facility.status,
          },
        },
        trxSession
      );

      // Emit Domain Events
      amenityManagementEvents.emit(AMENITY_EVENTS.FACILITY_CREATED, facility);
      if (!isDraft) {
        amenityManagementEvents.emit(AMENITY_EVENTS.FACILITY_PUBLISHED, facility);
      }
      try {
        const legacyDoc = toLegacyAmenityDoc(facility);
        await mongoose.connection.db.collection('amenities').updateOne(
          { _id: facility._id },
          { $set: legacyDoc },
          { upsert: true }
        );
      } catch (legacyErr) {
        // Safe non-blocking sync
      }

      return facility;
    };

    if (session) {
      return executeCreate(session);
    }
    return withTransactionRetry(executeCreate);
  }

  /**
   * Retrieves a facility by ID.
   * @param {string|import('mongoose').Types.ObjectId} facilityId
   * @param {string|import('mongoose').Types.ObjectId} [orgId]
   * @param {import('mongoose').ClientSession} [session]
   */
  async getFacilityById(facilityId, orgId, session) {
    const facility = await amenityFacilityRepository.findById(facilityId, orgId, session);
    if (!facility) {
      throw new HttpError(404, 'Facility not found');
    }
    return facility;
  }

  /**
   * Retrieves a facility by code.
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {string} code
   * @param {import('mongoose').ClientSession} [session]
   */
  async getFacilityByCode(orgId, code, session) {
    const facility = await amenityFacilityRepository.findByCode(orgId, code, session);
    if (!facility) {
      throw new HttpError(404, `Facility with code '${code}' not found`);
    }
    return facility;
  }

  /**
   * Updates an existing facility.
   * Atomically synchronizes child sub-room resources for ROOM_RESOURCE archetype.
   * Enforces dual-field state invariants and policies T1 & T2.
   *
   * @param {string|import('mongoose').Types.ObjectId} facilityId
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session]
   */
  async updateFacility(facilityId, orgId, updateData, session) {
    const executeUpdate = async (trxSession) => {
      const existing = await amenityFacilityRepository.findById(facilityId, orgId, trxSession);
      if (!existing) {
        throw new HttpError(404, 'Facility not found');
      }

      if (updateData.code) {
        const normalizedCode = updateData.code.trim().toUpperCase();
        const codeConflict = await amenityFacilityRepository.findByCode(orgId, normalizedCode, trxSession);
        if (codeConflict && codeConflict._id.toString() !== facilityId.toString()) {
          throw new HttpError(409, `Facility with code '${normalizedCode}' already exists`);
        }
        updateData.code = normalizedCode;
      }

      let transitionEvent = null;

      // 1. Moving to Draft (ACTIVE or INACTIVE -> DRAFT)
      if (updateData.isDraft === true || updateData.status === 'DRAFT') {
        // Policy T2: Check for ANY future active/confirmed reservations (no arbitrary date cap)
        const futureBookings = await amenityReservationService.getFutureActiveReservations(
          { orgId, facilityId },
          trxSession
        );
        if (futureBookings && futureBookings.length > 0) {
          throw new HttpError(
            409,
            `Cannot move facility to Draft while future confirmed bookings exist. Resolve existing bookings first.`
          );
        }
        updateData.isDraft = true;
        updateData.status = 'DRAFT';
        updateData.isActive = false;
      }
      // 2. Moving to Inactive (ACTIVE -> INACTIVE)
      else if (updateData.isActive === false || updateData.status === 'INACTIVE') {
        // Policy T1: Detect future confirmed bookings
        const futureBookings = await amenityReservationService.getFutureActiveReservations(
          { orgId, facilityId },
          trxSession
        );

        if (futureBookings && futureBookings.length > 0) {
          if (updateData.bookingAction === 'CANCEL_AND_REFUND') {
            for (const booking of futureBookings) {
              await amenityReservationService.cancelReservation(
                {
                  reservationId: booking._id,
                  orgId,
                  residentId: booking.residentId,
                  cancellationReason: 'Facility deactivated by administration',
                  cancelledBy: updateData.cancelledBy,
                  isManagementCancellation: true,
                },
                trxSession
              );
            }
          } else if (updateData.bookingAction !== 'HONOR_EXISTING') {
            throw new HttpError(
              409,
              `Facility has ${futureBookings.length} upcoming confirmed booking(s). Please specify bookingAction: 'HONOR_EXISTING' or 'CANCEL_AND_REFUND'.`,
              {
                requiresBookingAction: true,
                upcomingBookingsCount: futureBookings.length,
              }
            );
          }
        }

        updateData.isDraft = false;
        updateData.isActive = false;
        updateData.status = 'INACTIVE';
        transitionEvent = 'FACILITY_DEACTIVATED';
      }
      // 3. Moving to Active (INACTIVE -> ACTIVE or DRAFT -> ACTIVE / Publishing)
      else if (
        updateData.isActive === true ||
        updateData.status === 'ACTIVE' ||
        (updateData.isDraft === false && existing.isDraft)
      ) {
        if (existing.isDraft) {
          // Validate required minimum configuration
          const name = updateData.name || existing.name;
          const code = updateData.code || existing.code;
          const archetype = updateData.archetype || existing.archetype;
          const location = updateData.location !== undefined ? updateData.location : existing.location;
          const operatingHours = updateData.operatingHours || existing.operatingHours;
          const slotDurationMinutes = updateData.slotDurationMinutes || existing.slotDurationMinutes;

          if (
            !name ||
            !code ||
            !archetype ||
            !location ||
            typeof location !== 'string' ||
            !location.trim() ||
            !operatingHours?.length ||
            !slotDurationMinutes
          ) {
            throw new HttpError(
              400,
              'Cannot publish incomplete facility: name, code, archetype, location, operatingHours, and slotDurationMinutes are required'
            );
          }
          transitionEvent = 'FACILITY_PUBLISHED';
        }
        updateData.isDraft = false;
        updateData.isActive = true;
        updateData.status = 'ACTIVE';
      }

      // Clean non-schema metadata
      const { bookingAction, cancelledBy, ...cleanUpdate } = updateData;

      // Nested policy blocks are merged, so a partial edit (e.g. only baseRate) keeps
      // the other pricing / cancellation fields instead of resetting them to defaults.
      for (const key of ['pricingConfig', 'cancellationPolicy', 'paymentPolicy']) {
        if (cleanUpdate[key] && typeof cleanUpdate[key] === 'object') {
          const current = existing[key]?.toObject ? existing[key].toObject() : existing[key] || {};
          cleanUpdate[key] = { ...current, ...cleanUpdate[key] };
        }
      }

      const updated = await amenityFacilityRepository.update(facilityId, orgId, cleanUpdate, trxSession);
      if (!updated) {
        throw new HttpError(404, 'Facility not found');
      }

      if (updated.archetype === 'ROOM_RESOURCE' && Array.isArray(updateData.subRooms)) {
        await this._syncSubRooms(updated, updateData.subRooms, trxSession);
      } else if (updated.archetype === 'INVENTORY_TOOLS' && updateData.availableStock !== undefined) {
        const existingResources = await amenityResourceService.getAllResourcesByFacilityId(
          facilityId,
          orgId,
          trxSession
        );
        if (existingResources.length === 1 && !existingResources[0].isSerializedAsset) {
          await amenityResourceService.updateResource(
            existingResources[0]._id,
            orgId,
            { totalBulkStock: updateData.availableStock },
            trxSession
          );
        }
      }

      if (transitionEvent) {
        await amenityOutboxEventRepository.createEvent(
          {
            orgId: updated.orgId,
            eventType: transitionEvent,
            aggregateId: updated._id,
            aggregateType: 'AmenityFacility',
            payload: {
              facilityId: updated._id,
              code: updated.code,
              name: updated.name,
              isDraft: updated.isDraft,
              isActive: updated.isActive,
              status: updated.status,
            },
          },
          trxSession
        );

        if (transitionEvent === 'FACILITY_PUBLISHED') {
          amenityManagementEvents.emit(AMENITY_EVENTS.FACILITY_PUBLISHED, updated);
        } else if (transitionEvent === 'FACILITY_DEACTIVATED') {
          amenityManagementEvents.emit(AMENITY_EVENTS.FACILITY_DEACTIVATED, updated);
        }
      }

      try {
        const legacyDoc = toLegacyAmenityDoc(updated);
        await mongoose.connection.db.collection('amenities').updateOne(
          { _id: updated._id },
          { $set: legacyDoc }
        );
      } catch (legacyErr) {
        // Safe non-blocking sync
      }

      return updated;
    };

    if (session) {
      return executeUpdate(session);
    }
    return withTransactionRetry(executeUpdate);
  }

  /**
   * Soft deletes a facility and its associated child resources.
   * @param {string|import('mongoose').Types.ObjectId} facilityId
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {import('mongoose').ClientSession} [session]
   */
  async softDeleteFacility(facilityId, orgId, session) {
    const executeDelete = async (trxSession) => {
      const deleted = await amenityFacilityRepository.softDelete(facilityId, orgId, trxSession);
      if (!deleted) {
        throw new HttpError(404, 'Facility not found');
      }

      // Cascade soft delete to child resources if any
      const resources = await amenityResourceService.getResourcesByFacilityId(facilityId, orgId, trxSession);
      for (const res of resources) {
        await amenityResourceService.softDeleteResource(res._id, orgId, trxSession);
      }

      try {
        await mongoose.connection.db.collection('amenities').updateOne(
          { _id: deleted._id },
          { $set: { isDeleted: true, status: 'inactive' } }
        );
      } catch (legacyErr) {
        // Safe non-blocking sync
      }

      return deleted;
    };

    if (session) {
      return executeDelete(session);
    }
    return withTransactionRetry(executeDelete);
  }

  /**
   * Lists facilities with pagination and filter criteria using $facet aggregation pipeline.
   * @param {Object} queryParams
   */
  async listFacilities(queryParams) {
    return amenityFacilityRepository.findWithPagination(queryParams);
  }
}

export const amenityFacilityService = new AmenityFacilityService();
export default amenityFacilityService;
