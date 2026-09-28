import moment from 'moment-timezone';
import amenityFacilityRepository from '../../facilities/amenityFacility.repository.js';
import amenityResourceRepository from '../../resources/amenityResource.repository.js';
import amenityMaintenanceBlockRepository from '../../maintenance/amenityMaintenanceBlock.repository.js';
import amenityReservationHoldRepository from '../../holds/amenityReservationHold.repository.js';
import amenityReservationRepository from '../../reservations/amenityReservation.repository.js';
import {
  getProfile,
  bookingRuleError,
  effectiveWindow,
  candidateWindows,
  DEFAULT_TIMEZONE,
} from '../profiles/facilityProfiles.js';

const isBookableFacility = (facility) =>
  facility &&
  facility.isActive &&
  !facility.isDraft &&
  !facility.isDeleted &&
  !['DRAFT', 'INACTIVE', 'MAINTENANCE'].includes(facility.status);

const formatTo12Hour = (m) => m.format('h:mm A');

export class AvailabilityService {
  /**
   * Checks whether a window can be booked, according to the facility's archetype profile.
   *
   * Occupancy is uniform across archetypes: the units taken by overlapping active holds
   * and reservations (headcount for shared facilities, quantity for bulk inventory,
   * one for everything exclusive) plus the request must fit the capacity. Callers that
   * allocate (hold creation) run this under the facility mutex inside a transaction.
   *
   * @param {Object} params
   * @param {string|import('mongoose').Types.ObjectId} params.orgId
   * @param {string|import('mongoose').Types.ObjectId} params.facilityId
   * @param {string|import('mongoose').Types.ObjectId} [params.resourceId]
   * @param {Date} params.startDateTime
   * @param {Date} params.endDateTime
   * @param {number} [params.headcount=1]
   * @param {number} [params.quantity=1]
   * @param {number} [params.requestedQuantity] - legacy alias used when headcount/quantity are absent
   * @param {string} [params.excludeReservationId] - ignore this reservation (e.g. when moving it)
   * @param {boolean} [params.enforceRules=true] - apply booking rules (notice, windows, party size)
   * @param {import('mongoose').ClientSession} [session]
   */
  async checkAvailability(
    {
      orgId,
      facilityId,
      resourceId,
      startDateTime,
      endDateTime,
      headcount,
      quantity,
      requestedQuantity,
      excludeReservationId = null,
      enforceRules = true,
    },
    session
  ) {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const unavailable = (reason, extra = {}) => ({
      isAvailable: false,
      reason,
      effectiveStartDateTime: extra.effectiveStart || start,
      effectiveEndDateTime: extra.effectiveEnd || end,
      ...extra.fields,
    });

    const facility = await amenityFacilityRepository.findById(facilityId, orgId, session);
    if (!isBookableFacility(facility)) return unavailable('Facility is not active or does not exist');

    let resource = null;
    if (resourceId) {
      resource = await amenityResourceRepository.findById(resourceId, orgId, session);
      if (!resource || !resource.isActive || resource.isDeleted || String(resource.facilityId) !== String(facility._id)) {
        return unavailable('Resource is not active or does not exist');
      }
    }

    const profile = getProfile(facility);
    const hc = Math.max(1, Number(headcount ?? requestedQuantity) || 1);
    const qty = Math.max(1, Number(quantity ?? requestedQuantity) || 1);

    if (enforceRules) {
      const ruleError = bookingRuleError(facility, { start, end, headcount: hc, quantity: qty, resource });
      if (ruleError) return unavailable(ruleError);
    } else if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return unavailable('Invalid date range: start must be earlier than end');
    }

    const { effectiveStart, effectiveEnd } = effectiveWindow(facility, resource, start, end);
    const win = { effectiveStart, effectiveEnd };

    // Maintenance: a complete closure blocks; a partial one reduces pooled capacity.
    const maintenanceBlocks = await amenityMaintenanceBlockRepository.findOverlappingBlocks(
      { orgId, facilityId, resourceId, startDateTime: effectiveStart, endDateTime: effectiveEnd },
      session
    );
    const closure = maintenanceBlocks.find((b) => b.isCompleteClosure);
    if (closure) return unavailable(`Maintenance blackout active: ${closure.reason}`, win);
    const degraded = maintenanceBlocks
      .filter((b) => !b.isCompleteClosure && (b.degradedCapacity || 0) > 0)
      .reduce((sum, b) => sum + (b.degradedCapacity || 0), 0);

    const scope = { orgId, facilityId, resourceId: profile.requiresResource ? resourceId : resourceId || undefined };
    const [holds, reservations] = await Promise.all([
      amenityReservationHoldRepository.findOverlappingActiveHolds(
        { ...scope, effectiveStartDateTime: effectiveStart, effectiveEndDateTime: effectiveEnd },
        session
      ),
      amenityReservationRepository.findOverlappingActiveReservations(
        { ...scope, effectiveStartDateTime: effectiveStart, effectiveEndDateTime: effectiveEnd },
        session
      ),
    ]);

    const used = [...holds, ...reservations.filter((r) => String(r._id) !== String(excludeReservationId))].reduce(
      (sum, b) => sum + profile.unitsOf(b, resource),
      0
    );
    const baseCapacity = profile.capacity({ facility, resource });
    const capacity = facility.archetype === 'SHARED_CAPACITY' ? Math.max(0, baseCapacity - degraded) : baseCapacity;
    const requestedUnits = profile.unitsOf({ headcount: hc, quantity: qty }, resource);
    const availableUnits = Math.max(0, capacity - used);

    if (requestedUnits > availableUnits) {
      const reason =
        capacity <= 1
          ? 'Requested time is already booked or held'
          : `Only ${availableUnits} of ${capacity} place(s) left for the requested time`;
      return unavailable(reason, { ...win, fields: { availableUnits, maxCapacity: capacity } });
    }

    return {
      isAvailable: true,
      availableUnits,
      maxCapacity: capacity,
      effectiveStartDateTime: effectiveStart,
      effectiveEndDateTime: effectiveEnd,
    };
  }

  /**
   * Bookable windows a facility offers on a local date (slots, sessions, full day,
   * overnight check-in or loan pickups, depending on the archetype profile). Windows
   * that are past, outside the booking rules, full or under maintenance are omitted.
   *
   * @returns {Promise<{ slots: Array<{ start: string, end: string, label: string, startUtc: string, endUtc: string, availableUnits?: number, maxCapacity?: number }> }>}
   */
  async getDailySlots({ orgId, facilityId, resourceId, dateStr, requestedQuantity = 1, headcount, quantity }, session) {
    const facility = await amenityFacilityRepository.findById(facilityId, orgId, session);
    if (!isBookableFacility(facility)) return { slots: [] };

    const tz = facility.timezone || DEFAULT_TIMEZONE;
    const slots = [];
    for (const candidate of candidateWindows(facility, dateStr)) {
      const avail = await this.checkAvailability(
        {
          orgId,
          facilityId,
          resourceId,
          startDateTime: candidate.start,
          endDateTime: candidate.end,
          headcount: headcount ?? requestedQuantity,
          quantity: quantity ?? requestedQuantity,
        },
        session
      );
      if (!avail.isAvailable) continue;
      const ms = moment(candidate.start).tz(tz);
      const me = moment(candidate.end).tz(tz);
      slots.push({
        start: ms.format('HH:mm'),
        end: me.format('HH:mm'),
        label: candidate.label || `${formatTo12Hour(ms)} - ${formatTo12Hour(me)}`,
        startUtc: candidate.start.toISOString(),
        endUtc: candidate.end.toISOString(),
        availableUnits: avail.availableUnits,
        maxCapacity: avail.maxCapacity,
      });
    }
    return { slots };
  }
}

export const availabilityService = new AvailabilityService();
export default availabilityService;
