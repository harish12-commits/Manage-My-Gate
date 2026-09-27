import crypto from 'crypto';
import HttpError from '../../../utils/httpError.utils.js';
import amenityAccessPassRepository from './amenityAccessPass.repository.js';
import amenityReservationRepository from '../reservations/amenityReservation.repository.js';
import amenityFacilityRepository from '../facilities/amenityFacility.repository.js';
import amenityMaintenanceBlockRepository from '../maintenance/amenityMaintenanceBlock.repository.js';

export class AmenityAccessPassService {
  /**
   * Hashes a raw access token with SHA-256 for secure database storage.
   * @param {string} rawToken
   * @returns {string}
   */
  hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new HttpError(400, 'Invalid token: raw token string is required');
    }
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates an unhashed cryptographically secure random token string.
   * @param {number} [bytes=32]
   * @returns {string}
   */
  generateRawToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Normalizes any incoming scan payload (canonical MMG:AMENITY prefix, raw hex, or legacy JSON/IDs).
   * @param {string} input
   * @returns {string}
   */
  normalizeScanToken(input) {
    if (!input || typeof input !== 'string') return '';
    let trimmed = input.trim();

    // Check if it's a JSON payload
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.passToken) return String(parsed.passToken).trim();
        if (parsed.rawToken) return String(parsed.rawToken).trim();
        if (parsed.bookingId) return String(parsed.bookingId).trim();
        if (parsed.id) return String(parsed.id).trim();
      } catch {
        // ignore JSON parse failure
      }
    }

    // Strip canonical MMG:AMENITY: prefix if present
    if (trimmed.startsWith('MMG:AMENITY:')) {
      trimmed = trimmed.replace('MMG:AMENITY:', '').trim();
    }

    return trimmed;
  }

  /**
   * Issues an access pass for a confirmed reservation.
   * Stores SHA-256 hash in database and returns the rawToken to caller.
   *
   * @param {Object} params
   * @param {string|import('mongoose').Types.ObjectId} params.orgId
   * @param {string|import('mongoose').Types.ObjectId} params.reservationId
   * @param {'QR_DYNAMIC'|'PIN_CODE'|'RFID_NFC'} [params.passType='QR_DYNAMIC']
   * @param {Date} params.validFrom
   * @param {Date} params.validUntil
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<{ pass: any, rawToken: string }>}
   */
  async issueAccessPass(
    { orgId, reservationId, passType = 'QR_DYNAMIC', validFrom, validUntil },
    session
  ) {
    if (!orgId || !reservationId) {
      throw new HttpError(400, 'orgId and reservationId are required to issue an access pass');
    }

    const rawToken = this.generateRawToken(32);
    const passTokenHash = this.hashToken(rawToken);

    const pass = await amenityAccessPassRepository.create(
      {
        orgId,
        reservationId,
        passType,
        passTokenHash,
        qrData: `MMG:AMENITY:${rawToken}`,
        validFrom,
        validUntil,
      },
      session
    );

    return { pass, rawToken };
  }

  /**
   * Validates and records a turnstile check-in with anti-replay guard.
   * Supports both V2 AmenityAccessPass and V1 AmenityBooking seamlessly.
   *
   * @param {Object} params
   * @param {string|import('mongoose').Types.ObjectId} params.orgId
   * @param {string} params.rawToken
   * @param {string} [params.gateId]
   * @param {string|import('mongoose').Types.ObjectId} [params.guardId]
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<any>}
   */
  async validateAndRecordCheckIn({ orgId, rawToken, gateId, guardId }, session) {
    const mongoose = (await import('mongoose')).default;
    const token = this.normalizeScanToken(rawToken);

    if (!token) {
      throw new HttpError(400, 'Invalid token: QR scan or token string is required');
    }

    const passTokenHash = this.hashToken(token);

    // Step 1: Look for V2 AmenityAccessPass by token hash or reservation number / passcode
    // Query without orgId first to verify cross-tenant isolation
    let v2PassAcrossOrgs = await amenityAccessPassRepository.findByTokenHash(
      null,
      passTokenHash,
      session
    );

    if (!v2PassAcrossOrgs && token.length <= 30) {
      const cleanRef = token.toUpperCase().startsWith('RES-')
        ? token.toUpperCase()
        : `RES-${token.toUpperCase()}`;

      const seqMatch = token.match(/\d+$/);
      const seq = seqMatch ? seqMatch[0] : null;

      const orConditions = [
        { reservationNumber: token },
        { reservationNumber: cleanRef },
        { reservationNumber: token.replace(/^[A-Z]{2,6}-/i, '') },
      ];

      if (seq) {
        orConditions.push({ reservationNumber: new RegExp(`${seq}$`) });
      }

      if (mongoose.Types.ObjectId.isValid(token)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(token) });
      }

      const AmenityReservation =
        mongoose.models.AmenityReservation ||
        (await import('../reservations/amenityReservation.model.js')).default;

      const matchedRes = await AmenityReservation.findOne({
        $or: orConditions,
      }).session(session);

      if (matchedRes) {
        const passes = await amenityAccessPassRepository.findByReservationId(
          matchedRes._id,
          session
        );
        if (passes && passes.length > 0) {
          v2PassAcrossOrgs = passes.find((p) => !p.isRevoked) || passes[0];
        }
      }
    }

    if (v2PassAcrossOrgs) {
      // Tenant isolation check
      if (v2PassAcrossOrgs.orgId.toString() !== orgId.toString()) {
        throw new HttpError(403, 'Access denied: pass belongs to a different organization/community');
      }

      const pass = v2PassAcrossOrgs;

      // Step 2: Pass is not revoked
      if (pass.isRevoked) {
        throw new HttpError(
          403,
          `Access denied: pass was revoked (${pass.revokedReason || 'No reason provided'})`
        );
      }

      // Step 3: Anti-replay validation
      if (pass.checkInTimestamp !== null) {
        throw new HttpError(
          409,
          `Anti-replay violation: pass was already used for check-in at ${pass.checkInTimestamp.toISOString()}`
        );
      }

      // Step 4: Pass validity window
      // 15-minute early arrival window; 1-minute end tolerance
      const now = new Date();
      const earlyArrivalStart = new Date(pass.validFrom.getTime() - 15 * 60 * 1000);
      const toleranceEnd = new Date(pass.validUntil.getTime() + 1 * 60 * 1000);

      if (now < earlyArrivalStart) {
        const allowedTimeStr = earlyArrivalStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        throw new HttpError(403, `This pass is not yet valid. Entry permitted from ${allowedTimeStr}`);
      }
      if (now > toleranceEnd) {
        throw new HttpError(403, 'This amenity pass has expired');
      }

      // Step 5: Reservation is CONFIRMED
      const reservation = await amenityReservationRepository.findById(pass.reservationId, session);
      if (!reservation) {
        throw new HttpError(404, 'Associated reservation not found');
      }
      if (reservation.bookingStatus !== 'CONFIRMED') {
        throw new HttpError(
          403,
          `Access denied: associated reservation is ${reservation.bookingStatus}`
        );
      }

      // Step 6: Facility publication & deletion validation
      const facility = await amenityFacilityRepository.findById(reservation.facilityId, orgId, session);
      if (!facility || facility.isDeleted) {
        throw new HttpError(403, 'Access denied: facility is no longer available');
      }
      if (facility.isDraft || facility.status === 'DRAFT') {
        throw new HttpError(403, 'Access denied: facility is in draft mode');
      }

      // Step 7: Operational & Maintenance validation
      const activeBlocks = await amenityMaintenanceBlockRepository.findOverlappingBlocks(
        {
          orgId,
          facilityId: reservation.facilityId,
          resourceId: reservation.resourceId || null,
          startDateTime: now,
          endDateTime: now,
        },
        session
      );

      const activeClosure = activeBlocks.find(
        (b) =>
          (b.status === 'IN_PROGRESS' || b.status === 'SCHEDULED') &&
          (b.isCompleteClosure || (reservation.resourceId && b.resourceId?.toString() === reservation.resourceId.toString()))
      );

      if (activeClosure) {
        throw new HttpError(
          403,
          `Access denied: facility is under maintenance (${activeClosure.reason || 'Closure in progress'})`
        );
      }

      // All checks passed -> Record turnstile check-in atomically
      const updatedPass = await amenityAccessPassRepository.recordCheckIn(
        { orgId, passTokenHash: pass.passTokenHash, gateId, guardId },
        session
      );

      if (!updatedPass) {
        throw new HttpError(409, 'Anti-replay violation: pass was checked in concurrently');
      }

      // Populate resident, unit, organization, guard details
      const User = mongoose.models.User || (await import('../../user/user.model.js')).default;
      const user = await User.findById(reservation.residentId).populate('villaId').lean();

      const unitNumber =
        reservation.unitId?.unitNumber ||
        user?.villaNumber ||
        user?.villaId?.unitNumber ||
        user?.villaId?.villaNumber ||
        user?.flatNumber ||
        user?.unit ||
        'N/A';

      const Organization = mongoose.models.Organization || (await import('../../organization/organization.model.js')).default;
      const org = await Organization.findById(orgId).select('name').lean();

      const guard = guardId ? await User.findById(guardId).select('name username').lean() : null;

      return {
        valid: true,
        success: true,
        message: 'Pass validated and check-in recorded successfully',
        pass: {
          passId: updatedPass._id,
          passCode: updatedPass.passCode || reservation.reservationNumber,
          status: 'CHECKED_IN',
          validFrom: updatedPass.validFrom,
          validUntil: updatedPass.validUntil,
          checkInTimestamp: updatedPass.checkInTimestamp,
          isExit: false,
        },
        resident: {
          id: user?._id || reservation.residentId,
          name: user?.name || user?.username || 'Resident',
          photoUrl: user?.avatar || user?.profilePicture || user?.photo || null,
          unitNumber,
          villaNumber: unitNumber,
          phone: user?.phone || user?.phoneNumber || null,
        },
        facility: {
          id: facility._id,
          name: facility.name,
          location: facility.location || null,
        },
        booking: {
          id: reservation._id,
          bookingId: reservation.reservationNumber,
          reservationNumber: reservation.reservationNumber,
          date: reservation.date,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          status: reservation.bookingStatus,
          headcount: reservation.partySize || 1,
        },
        organisation: {
          id: org?._id || orgId,
          name: org?.name || 'Community',
        },
        guard: {
          id: guard?._id || guardId,
          name: guard?.name || guard?.username || 'Security Guard',
        },
      };
    }

    // Step 2: Fallback to V1 AmenityBooking
    const AmenityBooking = mongoose.models.AmenityBooking || (await import('../../amenityBooking/amenityBooking.model.js')).default;
    const orConditions = [
      { passTokenHash },
      { passToken: token },
      { bookingId: token },
    ];
    if (mongoose.Types.ObjectId.isValid(token)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(token) });
    }

    const bookingAcrossOrgs = await AmenityBooking.findOne({ $or: orConditions }).session(session);

    if (!bookingAcrossOrgs) {
      throw new HttpError(404, 'Invalid pass: token not found for this organization');
    }

    // Tenant isolation check
    if (bookingAcrossOrgs.orgId.toString() !== orgId.toString()) {
      throw new HttpError(403, 'Access denied: pass belongs to a different organization/community');
    }

    const booking = bookingAcrossOrgs;

    // V1 Validations
    if (booking.status === 'cancelled') {
      throw new HttpError(403, 'Booking has been cancelled.');
    }

    if (booking.status === 'completed') {
      throw new HttpError(409, 'Booking already completed.');
    }

    // Anti-replay check
    if (booking.checkInTime !== null || booking.status === 'checked-in') {
      throw new HttpError(
        409,
        `Anti-replay violation: booking was already checked in at ${booking.checkInTime ? booking.checkInTime.toISOString() : 'earlier'}`
      );
    }

    if (
      booking.paymentStatus === 'pending' &&
      !['PAY_AT_GATE', 'Pay_At_Gate', 'pay_at_gate'].includes(booking.paymentMethod) &&
      booking.status !== 'confirmed' &&
      booking.status !== 'approved'
    ) {
      throw new HttpError(400, 'Payment is pending.');
    }

    if (booking.qrStatus === 'expired') {
      throw new HttpError(403, 'This amenity pass has expired');
    }

    // Date and time validity: 15-minute early window, 1-minute end tolerance
    const moment = (await import('moment-timezone')).default;
    const TIMEZONE = 'Asia/Kolkata';
    const nowMoment = moment().tz(TIMEZONE);

    const bStart = moment.tz(`${booking.bookingDate}T${booking.startTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
    let bEnd = moment.tz(`${booking.bookingDate}T${booking.endTime}`, 'YYYY-MM-DDTHH:mm', TIMEZONE);
    if (bEnd.isBefore(bStart)) {
      bEnd.add(1, 'days');
    }

    const earlyArrivalStart = bStart.clone().subtract(15, 'minutes');
    const toleranceEnd = bEnd.clone().add(1, 'minutes');

    if (nowMoment.isBefore(earlyArrivalStart)) {
      const allowedTime = earlyArrivalStart.format('hh:mm A');
      throw new HttpError(403, `This pass is not yet valid. Entry permitted from ${allowedTime}`);
    }
    if (nowMoment.isAfter(toleranceEnd)) {
      throw new HttpError(403, 'This amenity pass has expired');
    }

    // Amenity status
    const Amenity = mongoose.models.Amenity || (await import('../../amenity/amenity.model.js')).default;
    const amenity = await Amenity.findById(booking.amenityId).session(session);
    if (amenity && amenity.status === 'inactive') {
      throw new HttpError(403, 'Amenity is currently unavailable.');
    }

    // Atomic update for V1 check-in
    const updatedBooking = await AmenityBooking.findOneAndUpdate(
      {
        _id: booking._id,
        orgId,
        status: { $in: ['confirmed', 'approved', 'pending'] },
        checkInTime: null,
      },
      {
        $set: {
          status: 'checked-in',
          checkInTime: new Date(),
          checkedInBy: guardId || null,
        },
      },
      { new: true, session }
    );

    if (!updatedBooking) {
      throw new HttpError(409, 'Anti-replay violation: booking was checked in concurrently or already used');
    }

    // Emit event for real-time socket delivery
    try {
      const { amenityBookingEventEmitter, AMENITY_BOOKING_CHECKED_IN } = await import(
        '../../amenityBooking/amenityBooking.events.js'
      );
      amenityBookingEventEmitter.emit(AMENITY_BOOKING_CHECKED_IN, updatedBooking);
    } catch {
      // Ignore event bus errors
    }

    // Populate resident, unit, organization, guard details
    const User = mongoose.models.User || (await import('../../user/user.model.js')).default;
    const user = await User.findById(booking.userId).populate('villaId').lean();

    const unitNumber =
      user?.villaNumber ||
      user?.villaId?.unitNumber ||
      user?.villaId?.villaNumber ||
      user?.flatNumber ||
      user?.unit ||
      'N/A';

    const Organization = mongoose.models.Organization || (await import('../../organization/organization.model.js')).default;
    const org = await Organization.findById(orgId).select('name').lean();

    const guard = guardId ? await User.findById(guardId).select('name username').lean() : null;
    const facilityName = amenity?.name || 'Amenity Facility';

    return {
      valid: true,
      success: true,
      message: 'Pass validated and check-in recorded successfully',
      pass: {
        passId: updatedBooking._id,
        passCode: updatedBooking.bookingId,
        status: 'CHECKED_IN',
        validFrom: bStart.toDate(),
        validUntil: bEnd.toDate(),
        checkInTimestamp: updatedBooking.checkInTime,
        isExit: false,
      },
      resident: {
        id: user?._id || booking.userId,
        name: user?.name || user?.username || 'Resident',
        photoUrl: user?.avatar || user?.profilePicture || user?.photo || null,
        unitNumber,
        villaNumber: unitNumber,
        phone: user?.phone || user?.phoneNumber || null,
      },
      facility: {
        id: booking.amenityId,
        name: facilityName,
        location: amenity?.location || null,
      },
      booking: {
        id: updatedBooking._id,
        bookingId: updatedBooking.bookingId,
        reservationNumber: updatedBooking.bookingId,
        date: updatedBooking.bookingDate,
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
        status: updatedBooking.status,
        headcount: updatedBooking.numberOfPersons || 1,
      },
      organisation: {
        id: org?._id || orgId,
        name: org?.name || 'Community',
      },
      guard: {
        id: guard?._id || guardId,
        name: guard?.name || guard?.username || 'Security Guard',
      },
    };
  }

  /**
   * Validates and records check-out with staff equipment inspection.
   *
   * @param {Object} params
   * @param {string|import('mongoose').Types.ObjectId} params.orgId
   * @param {string} params.rawToken
   * @param {Object} [params.inspectionDetails]
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<any>}
   */
  async recordCheckOut({ orgId, rawToken, inspectionDetails }, session) {
    const passTokenHash = this.hashToken(rawToken);

    const updatedPass = await amenityAccessPassRepository.recordCheckOut(
      { orgId, passTokenHash, inspectionDetails },
      session
    );

    if (updatedPass) {
      return updatedPass;
    }

    const existingPass = await amenityAccessPassRepository.findByTokenHash(
      orgId,
      passTokenHash,
      session
    );

    if (!existingPass) {
      throw new HttpError(404, 'Invalid pass: token not found for this organization');
    }

    if (!existingPass.checkInTimestamp) {
      if (existingPass.isRevoked) {
        throw new HttpError(403, 'Access denied: pass is revoked');
      }
      throw new HttpError(400, 'Check-out rejected: pass has not been checked in yet');
    }

    if (existingPass.checkOutTimestamp) {
      throw new HttpError(409, 'Pass has already been checked out');
    }

    if (existingPass.isRevoked) {
      throw new HttpError(403, 'Access denied: pass is revoked');
    }

    throw new HttpError(400, 'Check-out validation failed');
  }

  /**
   * Revokes a single access pass.
   * @param {string|import('mongoose').Types.ObjectId} passId
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {string} reason
   * @param {import('mongoose').ClientSession} [session]
   */
  async revokePass(passId, orgId, reason, session) {
    const revoked = await amenityAccessPassRepository.revokePass(passId, orgId, reason, session);
    if (!revoked) {
      throw new HttpError(404, 'Pass not found or already revoked');
    }
    return revoked;
  }

  /**
   * Revokes all active passes for a reservation.
   * @param {string|import('mongoose').Types.ObjectId} reservationId
   * @param {string|import('mongoose').Types.ObjectId} orgId
   * @param {string} reason
   * @param {import('mongoose').ClientSession} [session]
   */
  async revokeAllByReservationId(reservationId, orgId, reason, session) {
    return amenityAccessPassRepository.revokeAllByReservationId(
      reservationId,
      orgId,
      reason,
      session
    );
  }

  /**
   * Retrieves all passes issued for a reservation.
   * @param {string|import('mongoose').Types.ObjectId} reservationId
   * @param {import('mongoose').ClientSession} [session]
   */
  async getPassesByReservationId(reservationId, session) {
    return amenityAccessPassRepository.findByReservationId(reservationId, session);
  }
}

export const amenityAccessPassService = new AmenityAccessPassService();
export default amenityAccessPassService;
