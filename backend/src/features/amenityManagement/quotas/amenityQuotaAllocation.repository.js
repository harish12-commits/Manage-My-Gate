import mongoose from 'mongoose';
import AmenityQuotaAllocation from './amenityQuotaAllocation.model.js';
import { getValidSession } from '../domain/concurrency/transaction.utils.js';

export class AmenityQuotaAllocationRepository {
  /**
   * Finds quota document by deterministic ID.
   * @param {string} quotaId
   * @param {mongoose.ClientSession} [session]
   */
  async findById(quotaId, session) {
    return AmenityQuotaAllocation.findById(quotaId).session(getValidSession(session));
  }

  /**
   * Atomically reserves quota units if total (reserved + consumed + requested) <= quotaLimit.
   * Creates the quota document if it does not yet exist.
   * Returns updated doc, or null if quota limit would be exceeded.
   * @param {Object} params
   * @param {string} params.quotaId - QUOTA:<orgId>:<unitId>:<facilityId>:<periodToken>
   * @param {string|mongoose.Types.ObjectId} params.orgId
   * @param {string|mongoose.Types.ObjectId} params.unitId
   * @param {string|mongoose.Types.ObjectId} params.facilityId
   * @param {string} params.quotaPeriod - DAILY | WEEKLY | MONTHLY
   * @param {string} params.periodToken
   * @param {number} params.quotaLimit
   * @param {number} params.requestedUnits
   * @param {mongoose.ClientSession} [session]
   */
  async reserveQuota(
    { quotaId, orgId, unitId, facilityId, quotaPeriod, periodToken, quotaLimit, requestedUnits },
    session
  ) {
    const validSession = getValidSession(session);

    // 1. Try atomic conditional increment if document exists
    let quota = await AmenityQuotaAllocation.findOneAndUpdate(
      {
        _id: quotaId,
        // The current community allowance applies (not the one stored when the period began).
        $expr: {
          $lte: [{ $add: ['$reservedAmount', '$consumedAmount', requestedUnits] }, quotaLimit],
        },
      },
      {
        $inc: { reservedAmount: requestedUnits, version: 1 },
        $set: { quotaLimit },
      },
      { session: validSession, returnDocument: 'after' }
    );

    if (quota) return quota;

    // 2. Document does not match condition; check if it exists (meaning limit exceeded) or is new
    const existing = await AmenityQuotaAllocation.findById(quotaId).session(validSession);
    if (existing) {
      // Document exists but exceeded quotaLimit
      return null;
    }

    // 3. New period document; verify requestedUnits does not exceed limit
    if (requestedUnits > quotaLimit) {
      return null;
    }

    try {
      const options = validSession ? { session: validSession } : {};
      const [created] = await AmenityQuotaAllocation.create(
        [
          {
            _id: quotaId,
            orgId,
            unitId,
            facilityId,
            quotaPeriod,
            periodToken,
            quotaLimit,
            reservedAmount: requestedUnits,
            consumedAmount: 0,
            version: 1,
          },
        ],
        options
      );
      return created;
    } catch (err) {
      if (err.code === 11000) {
        // Concurrently created: retry atomic condition
        return AmenityQuotaAllocation.findOneAndUpdate(
          {
            _id: quotaId,
            $expr: {
              $lte: [{ $add: ['$reservedAmount', '$consumedAmount', requestedUnits] }, quotaLimit],
            },
          },
          {
            $inc: { reservedAmount: requestedUnits, version: 1 },
            $set: { quotaLimit },
          },
          { session: validSession, returnDocument: 'after' }
        );
      }
      throw err;
    }
  }

  /**
   * Atomically shifts reserved amount to consumed amount upon booking confirmation.
   * @param {string} quotaId
   * @param {number} requestedUnits
   * @param {mongoose.ClientSession} [session]
   */
  async promoteQuota(quotaId, requestedUnits, session) {
    return AmenityQuotaAllocation.findOneAndUpdate(
      { _id: quotaId },
      {
        $inc: {
          reservedAmount: -requestedUnits,
          consumedAmount: requestedUnits,
          version: 1,
        },
      },
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Atomically releases reserved quota units upon hold expiration or rejection.
   * @param {string} quotaId
   * @param {number} requestedUnits
   * @param {mongoose.ClientSession} [session]
   */
  async releaseQuota(quotaId, requestedUnits, session) {
    return AmenityQuotaAllocation.findOneAndUpdate(
      { _id: quotaId },
      {
        $inc: {
          reservedAmount: -requestedUnits,
          version: 1,
        },
      },
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }

  /**
   * Atomically refunds consumed quota units upon cancellation if community policy permits.
   * @param {string} quotaId
   * @param {number} requestedUnits
   * @param {mongoose.ClientSession} [session]
   */
  async refundQuota(quotaId, requestedUnits, session) {
    return AmenityQuotaAllocation.findOneAndUpdate(
      { _id: quotaId },
      {
        $inc: {
          consumedAmount: -requestedUnits,
          version: 1,
        },
      },
      { session: getValidSession(session), returnDocument: 'after' }
    );
  }
}

export const amenityQuotaAllocationRepository = new AmenityQuotaAllocationRepository();
export default amenityQuotaAllocationRepository;
