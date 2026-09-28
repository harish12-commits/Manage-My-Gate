import mongoose from 'mongoose';
import AmenityReservation from './amenityReservation.model.js';
import { getValidSession } from '../domain/concurrency/transaction.utils.js';

export class AmenityReservationRepository {
  /**
   * Creates a new reservation document.
   * @param {Object} reservationData
   * @param {mongoose.ClientSession} [session]
   */
  async create(reservationData, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession } : {};
    const [doc] = await AmenityReservation.create([reservationData], options);
    return AmenityReservation.populate(doc, [
      { path: 'facilityId', select: 'name timezone type category isExclusive' },
      { path: 'resourceId', select: 'name type' },
      { path: 'residentId', select: 'name fullName firstName lastName username email villaId villaNumber' },
      { path: 'unitId', select: 'unitNumber villaNumber block floor' }
    ]);
  }

  /**
   * Finds a reservation by ID with optional orgId tenant filter.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {string|mongoose.Types.ObjectId} [orgId]
   * @param {mongoose.ClientSession} [session]
   */
  async findById(reservationId, orgId = null, session = null) {
    const filter = { _id: reservationId };
    if (orgId && typeof orgId !== 'function' && !orgId.inTransaction) {
      const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
      filter.$or = [{ orgId: targetOrgId }, { orgId: String(orgId) }];
    }
    const actualSession = (orgId && (orgId.inTransaction || typeof orgId === 'object')) ? orgId : session;
    return AmenityReservation.findOne(filter)
      .populate('facilityId', 'name timezone type category isExclusive')
      .populate('resourceId', 'name type')
      .populate('residentId', 'name fullName firstName lastName username email villaId villaNumber')
      .populate('unitId', 'unitNumber villaNumber block floor')
      .session(getValidSession(actualSession));
  }

  /**
   * Finds a reservation by tenant-scoped reservation number.
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {string} reservationNumber
   * @param {mongoose.ClientSession} [session]
   */
  async findByReservationNumber(orgId, reservationNumber, session) {
    return AmenityReservation.findOne({ orgId, reservationNumber })
      .populate('facilityId', 'name timezone type category isExclusive')
      .populate('resourceId', 'name type')
      .populate('residentId', 'name fullName firstName lastName username email villaId villaNumber')
      .populate('unitId', 'unitNumber villaNumber block floor')
      .session(getValidSession(session));
  }

  /**
   * Finds active reservations overlapping an effective date range.
   * Excludes CANCELLED and REJECTED bookings.
   * @param {Object} params
   */
  async findOverlappingActiveReservations(
    { orgId, facilityId, resourceId, resourceIds, effectiveStartDateTime, effectiveEndDateTime },
    session
  ) {
    const filter = {
      orgId,
      facilityId,
      bookingStatus: { $in: ['PENDING_APPROVAL', 'CONFIRMED'] },
      effectiveStartDateTime: { $lt: effectiveEndDateTime },
      effectiveEndDateTime: { $gt: effectiveStartDateTime },
    };
    if (resourceIds && Array.isArray(resourceIds) && resourceIds.length > 0) {
      filter.resourceId = { $in: resourceIds };
    } else if (resourceId) {
      filter.resourceId = resourceId;
    }

    return AmenityReservation.find(filter).session(getValidSession(session));
  }

  /**
   * Finds all future active/confirmed reservations for a facility without an arbitrary date cap.
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.facilityId
   * @param {mongoose.ClientSession} [session]
   */
  async findFutureActiveReservations({ orgId, facilityId }, session) {
    const now = new Date();
    const filter = {
      orgId,
      facilityId,
      bookingStatus: { $in: ['PENDING_APPROVAL', 'CONFIRMED'] },
      effectiveEndDateTime: { $gte: now },
    };
    return AmenityReservation.find(filter).session(getValidSession(session));
  }

  /**
   * Updates state dimensions on a reservation document.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {Object} updateFields
   * @param {mongoose.ClientSession} [session]
   */
  async updateStateDimensions(reservationId, updateFields, session) {
    return AmenityReservation.findOneAndUpdate(
      { _id: reservationId },
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { session: getValidSession(session), returnDocument: 'after', runValidators: true }
    );
  }

  /**
   * Appends an action entry to the approval history array.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {Object} historyEntry
   * @param {mongoose.ClientSession} [session]
   */
  async appendApprovalHistory(reservationId, historyEntry, session) {
    return AmenityReservation.findOneAndUpdate(
      { _id: reservationId },
      {
        $push: { approvalHistory: historyEntry },
        $inc: { version: 1 },
      },
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Paginated list query with total count via $facet aggregation pipeline.
   * @param {Object} params
   */
  async findWithPagination({
    orgId,
    facilityId,
    residentId,
    unitId,
    bookingStatus,
    paymentStatus,
    approvalStatus,
    adminReviewStatus,
    page = 1,
    limit = 10,
  }) {
    const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
    
    // Construct flexible matching query for AmenityReservation (amenity_management_reservations)
    const matchConditions = [
      { $or: [{ orgId: targetOrgId }, { orgId: String(orgId) }] }
    ];

    if (facilityId) {
      const targetFacId = mongoose.Types.ObjectId.isValid(facilityId) ? new mongoose.Types.ObjectId(facilityId) : facilityId;
      matchConditions.push({ $or: [{ facilityId: targetFacId }, { facilityId: String(facilityId) }] });
    }
    if (residentId) {
      const targetResId = mongoose.Types.ObjectId.isValid(residentId) ? new mongoose.Types.ObjectId(residentId) : residentId;
      matchConditions.push({ $or: [{ residentId: targetResId }, { residentId: String(residentId) }] });
    }
    if (unitId) {
      const targetUnitId = mongoose.Types.ObjectId.isValid(unitId) ? new mongoose.Types.ObjectId(unitId) : unitId;
      matchConditions.push({ $or: [{ unitId: targetUnitId }, { unitId: String(unitId) }] });
    }
    if (bookingStatus && bookingStatus !== 'All' && bookingStatus !== 'ALL') {
      matchConditions.push({ bookingStatus: bookingStatus.toUpperCase() });
    }
    if (paymentStatus && paymentStatus !== 'All' && paymentStatus !== 'ALL') {
      matchConditions.push({ paymentStatus: paymentStatus.toUpperCase() });
    }
    if (approvalStatus && approvalStatus !== 'All' && approvalStatus !== 'ALL') {
      matchConditions.push({ approvalStatus: approvalStatus.toUpperCase() });
    }

    if (adminReviewStatus) {
      matchConditions.push({ 'adminReview.status': adminReviewStatus });
    }

    const match = matchConditions.length === 1 ? matchConditions[0] : { $and: matchConditions };

    const v2Reservations = await AmenityReservation.find(match)
      .populate('facilityId', 'name type images category location pricingConfig operatingHours')
      .populate('resourceId', 'name identifier type')
      .populate('residentId', 'name username email phone profilePicture')
      .populate('unitId', 'unitNumber villaNumber block floor')
      .sort({ createdAt: -1 })
      .lean();

    // Query legacy amenity_bookings collection for complete dual-collection sync
    let v1Bookings = [];
    try {
      const AmenityBooking = (await import('../../amenityBooking/amenityBooking.model.js')).default;
      const v1MatchConditions = [
        { $or: [{ orgId: targetOrgId }, { orgId: String(orgId) }] }
      ];
      if (facilityId) {
        const targetFacId = mongoose.Types.ObjectId.isValid(facilityId) ? new mongoose.Types.ObjectId(facilityId) : facilityId;
        v1MatchConditions.push({ $or: [{ amenityId: targetFacId }, { amenityId: String(facilityId) }] });
      }
      if (residentId) {
        const targetResId = mongoose.Types.ObjectId.isValid(residentId) ? new mongoose.Types.ObjectId(residentId) : residentId;
        v1MatchConditions.push({ $or: [{ userId: targetResId }, { userId: String(residentId) }] });
      }
      if (bookingStatus && bookingStatus !== 'All' && bookingStatus !== 'ALL') {
        v1MatchConditions.push({ status: bookingStatus.toLowerCase() });
      }
      const v1Query = v1MatchConditions.length === 1 ? v1MatchConditions[0] : { $and: v1MatchConditions };

      v1Bookings = await AmenityBooking.find(v1Query)
        .populate('amenityId', 'name type images location bookingRules pricing category')
        .populate('userId', 'name username email phone profilePicture')
        .sort({ createdAt: -1 })
        .lean();
    } catch (v1Err) {
      // Graceful fallback
    }

    // Adapt v1 bookings into v2 AmenityReservation shape
    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';

    const adaptedV1 = v1Bookings.map((b) => {
      const fac = b.amenityId || {};
      const bookingDateStr = b.bookingDate || '';
      const startTimeStr = b.startTime || '00:00';
      const endTimeStr = b.endTime || '23:59';
      
      let startDt = b.createdAt;
      let endDt = b.createdAt;
      if (bookingDateStr) {
        startDt = moment.tz(`${bookingDateStr}T${startTimeStr}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
        endDt = moment.tz(`${bookingDateStr}T${endTimeStr}`, 'YYYY-MM-DDTHH:mm', TIMEZONE).toDate();
      }

      const pConfig = fac.pricing || fac.pricingConfig || {};

      return {
        _id: b._id,
        orgId: b.orgId,
        facilityId: typeof fac === 'object' && fac._id ? fac : { _id: b.amenityId, name: fac.name || 'Amenity Facility' },
        resourceId: b.resourceId ? { _id: b.resourceId, name: 'Resource' } : null,
        residentId: typeof b.userId === 'object' && b.userId ? b.userId : { _id: b.userId },
        unitId: b.unitId ? { _id: b.unitId } : null,
        reservationNumber: b.bookingId || b.bookingNumber || String(b._id),
        requestedStartDateTime: startDt,
        requestedEndDateTime: endDt,
        effectiveStartDateTime: startDt,
        effectiveEndDateTime: endDt,
        startDateTime: startDt,
        endDateTime: endDt,
        headcount: b.numberOfPersons || 1,
        quantity: 1,
        bookingStatus: (b.status || 'CONFIRMED').toUpperCase(),
        paymentStatus: (b.paymentStatus === 'success' || b.paymentStatus === 'paid') ? 'PAID' : (b.paymentStatus || 'NOT_REQUIRED').toUpperCase(),
        approvalStatus: 'NOT_REQUIRED',
        accessStatus: 'PASS_GENERATED',
        completionStatus: 'PENDING',
        totalAmount: b.totalPrice || b.pricingDetails?.totalAmount || 0,
        paidAmount: b.totalPrice || 0,
        paymentMethod: (b.paymentMethod || 'NONE').toUpperCase(),
        createdAt: b.createdAt || new Date(),
        updatedAt: b.updatedAt || new Date(),
      };
    });

    // Merge v2 reservations and adapted v1 bookings, deduplicating by _id string
    const existingIds = new Set(v2Reservations.map((r) => String(r._id)));
    const merged = [...v2Reservations];
    for (const item of adaptedV1) {
      if (!existingIds.has(String(item._id))) {
        existingIds.add(String(item._id));
        merged.push(item);
      }
    }

    // Sort by createdAt descending
    merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const total = merged.length;
    const skip = (page - 1) * limit;
    const paginatedItems = merged.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return { data: paginatedItems, items: paginatedItems, total, page, limit, totalPages };
  }

  /**
   * Finds reservations for calendar view within a date range with optional filtering.
   * Matches reservations overlapping [startDate, endDate].
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|Date} [params.startDate]
   * @param {string|Date} [params.endDate]
   * @param {string|mongoose.Types.ObjectId} [params.facilityId]
   * @param {string|mongoose.Types.ObjectId} [params.resourceId]
   * @param {string} [params.bookingStatus]
   * @param {string} [params.paymentStatus]
   * @param {mongoose.ClientSession} [session]
   */
  async findEventsForCalendar(
    {
      orgId,
      startDate,
      endDate,
      facilityId,
      resourceId,
      bookingStatus,
      paymentStatus,
    },
    session
  ) {
    const filter = { orgId: new mongoose.Types.ObjectId(orgId) };

    if (startDate && endDate) {
      const rangeStart = new Date(startDate);
      const rangeEnd = String(endDate).includes('T')
        ? new Date(endDate)
        : new Date(`${endDate}T23:59:59.999Z`);
      filter.effectiveStartDateTime = { $lt: rangeEnd };
      filter.effectiveEndDateTime = { $gt: rangeStart };
    } else if (startDate) {
      const rangeStart = new Date(startDate);
      filter.effectiveEndDateTime = { $gt: rangeStart };
    } else if (endDate) {
      const rangeEnd = String(endDate).includes('T')
        ? new Date(endDate)
        : new Date(`${endDate}T23:59:59.999Z`);
      filter.effectiveStartDateTime = { $lt: rangeEnd };
    }

    if (facilityId && facilityId !== 'All') {
      filter.facilityId = new mongoose.Types.ObjectId(facilityId);
    }
    if (resourceId && resourceId !== 'All') {
      filter.resourceId = new mongoose.Types.ObjectId(resourceId);
    }
    if (bookingStatus && bookingStatus !== 'All') {
      filter.bookingStatus = bookingStatus.toUpperCase();
    }
    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus.toUpperCase();
    }

    return AmenityReservation.find(filter)
      .populate('facilityId', 'name type images location bookingRules category isExclusive pricingConfig')
      .populate('resourceId', 'name type resourceCode capacity')
      .populate('residentId', 'name email profilePicture flatNumber building tower phoneNumber villaNumber username')
      .populate('unitId', 'unitNumber villaNumber block floor')
      .sort({ effectiveStartDateTime: 1 })
      .session(getValidSession(session))
      .lean();
  }
}

export const amenityReservationRepository = new AmenityReservationRepository();
export default amenityReservationRepository;
