import mongoose from 'mongoose';
import AmenityAccessPass from './amenityAccessPass.model.js';
import { getValidSession } from '../domain/concurrency/transaction.utils.js';

export class AmenityAccessPassRepository {
  /**
   * Creates an access pass document.
   * @param {Object} passData
   * @param {mongoose.ClientSession} [session]
   */
  async create(passData, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession } : {};
    const [doc] = await AmenityAccessPass.create([passData], options);
    return doc;
  }

  /**
   * Finds pass by ID.
   * @param {string|mongoose.Types.ObjectId} passId
   * @param {mongoose.ClientSession} [session]
   */
  async findById(passId, session) {
    return AmenityAccessPass.findById(passId).session(getValidSession(session));
  }

  /**
   * Finds pass by token hash within an organization.
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {string} passTokenHash
   * @param {mongoose.ClientSession} [session]
   */
  async findByTokenHash(orgId, passTokenHash, session) {
    const query = { passTokenHash };
    if (orgId) {
      query.orgId = orgId;
    }
    return AmenityAccessPass.findOne(query).session(getValidSession(session));
  }

  /**
   * Finds all passes associated with a reservation.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {mongoose.ClientSession} [session]
   */
  async findByReservationId(reservationId, session) {
    return AmenityAccessPass.find({ reservationId }).session(getValidSession(session));
  }

  /**
   * Executes atomic turnstile check-in with anti-replay guard.
   * Rejects if expired, revoked, or checkInTimestamp is already populated.
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string} params.passTokenHash
   * @param {string} [params.gateId]
   * @param {mongoose.ClientSession} [session]
   */
  async recordCheckIn({ orgId, passTokenHash, gateId, guardId, earlyMinutes = 15 }, session) {
    const now = new Date();
    // Early arrival window from community settings (validFrom <= now + earlyMinutes)
    const earlyArrivalBoundary = new Date(now.getTime() + earlyMinutes * 60 * 1000);
    // 1-minute end-time tolerance (validUntil >= now - 1 min)
    const endToleranceBoundary = new Date(now.getTime() - 1 * 60 * 1000);

    const update = {
      $set: {
        checkInTimestamp: now,
        gateId: gateId || null,
      },
    };
    if (guardId) {
      update.$set['inspectionDetails.checkedOutByStaff'] = guardId;
    }

    return AmenityAccessPass.findOneAndUpdate(
      {
        orgId,
        passTokenHash,
        isRevoked: false,
        validFrom: { $lte: earlyArrivalBoundary },
        validUntil: { $gte: endToleranceBoundary },
        checkInTimestamp: null, // Anti-replay check
      },
      update,
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Executes atomic check-out and records staff inspection details.
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string} params.passTokenHash
   * @param {Object} [params.inspectionDetails]
   * @param {mongoose.ClientSession} [session]
   */
  async recordCheckOut({ orgId, passTokenHash, inspectionDetails }, session) {
    const now = new Date();
    const update = {
      $set: { checkOutTimestamp: now },
    };
    if (inspectionDetails) {
      update.$set.inspectionDetails = inspectionDetails;
    }

    return AmenityAccessPass.findOneAndUpdate(
      {
        orgId,
        passTokenHash,
        checkInTimestamp: { $ne: null },
        checkOutTimestamp: null,
      },
      update,
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Revokes an active pass.
   * @param {string|mongoose.Types.ObjectId} passId
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {string} reason
   * @param {mongoose.ClientSession} [session]
   */
  async revokePass(passId, orgId, reason, session) {
    return AmenityAccessPass.findOneAndUpdate(
      { _id: passId, orgId, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Revokes all active passes for a reservation upon cancellation.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {string} reason
   * @param {mongoose.ClientSession} [session]
   */
  async revokeAllByReservationId(reservationId, orgId, reason, session) {
    return AmenityAccessPass.updateMany(
      { reservationId, orgId, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
      { session: getValidSession(session) }
    );
  }
}

export const amenityAccessPassRepository = new AmenityAccessPassRepository();
export default amenityAccessPassRepository;
