import mongoose from 'mongoose';
import AmenityReservationHold from './amenityReservationHold.model.js';
import { getValidSession } from '../domain/concurrency/transaction.utils.js';

export class AmenityReservationHoldRepository {
  /**
   * Creates a new ephemeral reservation hold document.
   * @param {Object} holdData
   * @param {mongoose.ClientSession} [session]
   */
  async create(holdData, session) {
    const validSession = getValidSession(session);
    const options = validSession ? { session: validSession } : {};
    const [doc] = await AmenityReservationHold.create([holdData], options);
    return doc;
  }

  /**
   * Finds hold by ID with optional orgId tenant filter.
   * @param {string|mongoose.Types.ObjectId} holdId
   * @param {string|mongoose.Types.ObjectId} [orgId]
   * @param {mongoose.ClientSession} [session]
   */
  async findById(holdId, orgId = null, session = null) {
    const filter = { _id: holdId };
    if (orgId && typeof orgId !== 'function' && !orgId.inTransaction) {
      const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
      filter.$or = [{ orgId: targetOrgId }, { orgId: String(orgId) }];
    }
    const actualSession = (orgId && (orgId.inTransaction || typeof orgId === 'object')) ? orgId : session;
    return AmenityReservationHold.findOne(filter).session(getValidSession(actualSession));
  }

  /**
   * Finds an ACTIVE, non-expired hold by ID.
   * Explicitly checks expiresAt > now (does not rely on TTL delay).
   * @param {string|mongoose.Types.ObjectId} holdId
   * @param {string|mongoose.Types.ObjectId} [orgId]
   * @param {mongoose.ClientSession} [session]
   */
  async findActiveById(holdId, orgId = null, session = null) {
    const filter = {
      _id: holdId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    };
    if (orgId && typeof orgId !== 'function' && !orgId.inTransaction) {
      const targetOrgId = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;
      filter.$or = [{ orgId: targetOrgId }, { orgId: String(orgId) }];
    }
    const actualSession = (orgId && (orgId.inTransaction || typeof orgId === 'object')) ? orgId : session;
    return AmenityReservationHold.findOne(filter).session(getValidSession(actualSession));
  }

  /**
   * State-guarded status transition for hold document.
   * E.g. ACTIVE -> PROMOTED or ACTIVE -> EXPIRED.
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.holdId
   * @param {string} params.fromStatus
   * @param {string} params.toStatus
   * @param {mongoose.ClientSession} [session]
   */
  async transitionStatus({ holdId, fromStatus, toStatus }, session) {
    return AmenityReservationHold.findOneAndUpdate(
      { _id: holdId, status: fromStatus },
      { $set: { status: toStatus } },
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Finds active holds overlapping a temporal range.
   * @param {Object} params
   */
  async findOverlappingActiveHolds(
    { orgId, facilityId, resourceId, effectiveStartDateTime, effectiveEndDateTime },
    session
  ) {
    const filter = {
      orgId,
      facilityId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
      effectiveStartDateTime: { $lt: effectiveEndDateTime },
      effectiveEndDateTime: { $gt: effectiveStartDateTime },
    };
    if (resourceId) filter.resourceId = resourceId;

    return AmenityReservationHold.find(filter).session(getValidSession(session));
  }

  /**
   * Finds expired active holds for background expiration workers.
   * @param {number} [limit=50]
   */
  async findExpiredActiveHolds(limit = 50) {
    return AmenityReservationHold.find({
      status: 'ACTIVE',
      expiresAt: { $lte: new Date() },
    }).limit(limit);
  }
}

export const amenityReservationHoldRepository = new AmenityReservationHoldRepository();
export default amenityReservationHoldRepository;
