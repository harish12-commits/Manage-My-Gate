import mongoose from 'mongoose';
import FinancialLedgerEntry from './financialLedgerEntry.model.js';
import logger from '../../utils/logger.utils.js';

export class FinancialLedgerRepository {
  /**
   * Helper to ensure active session is applied to query/save.
   */
  _getActiveSession(session) {
    if (session && typeof session.inTransaction === 'function' && session.inTransaction()) {
      return session;
    }
    return null;
  }

  /**
   * Create a double-entry financial ledger record atomically.
   * Concurrency-safe against race conditions via unique index on idempotencyKey.
   * @param {object} data
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<{ entry: object, alreadyExists: boolean }>}
   */
  async createEntry(data, session = null) {
    const activeSession = this._getActiveSession(session);

    // 1. Fast-path: Check if entry with this idempotencyKey already exists
    if (data.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(data.idempotencyKey, activeSession);
      if (existing) {
        return { entry: existing, alreadyExists: true };
      }
    }

    try {
      const entry = new FinancialLedgerEntry(data);
      const saved = await entry.save(activeSession ? { session: activeSession } : undefined);
      return { entry: saved, alreadyExists: false };
    } catch (err) {
      // 2. Concurrency-safe fallback: If concurrent execution hit unique index constraint
      if (err.code === 11000) {
        logger.info('financialLedger.duplicate_key_detected', {
          idempotencyKey: data.idempotencyKey,
        });
        const existing = await this.findByIdempotencyKey(data.idempotencyKey, activeSession);
        if (existing) {
          return { entry: existing, alreadyExists: true };
        }
      }
      throw err;
    }
  }

  /**
   * Find entry by transaction ID.
   */
  async findByTransactionId(transactionId, session = null) {
    const activeSession = this._getActiveSession(session);
    const query = FinancialLedgerEntry.findOne({ transactionId });
    if (activeSession) query.session(activeSession);
    return await query;
  }

  /**
   * Find entries by payment ID.
   */
  async findByPaymentId(paymentId, session = null) {
    const activeSession = this._getActiveSession(session);
    const query = FinancialLedgerEntry.find({ paymentId }).sort({ createdAt: 1 });
    if (activeSession) query.session(activeSession);
    return await query;
  }

  /**
   * Find entry by deterministic idempotency key.
   */
  async findByIdempotencyKey(idempotencyKey, session = null) {
    const activeSession = this._getActiveSession(session);
    const query = FinancialLedgerEntry.findOne({ idempotencyKey });
    if (activeSession) query.session(activeSession);
    return await query;
  }

  /**
   * Find entries by reference entity.
   */
  async findByReference(referenceType, referenceId, session = null) {
    const activeSession = this._getActiveSession(session);
    const query = FinancialLedgerEntry.find({
      referenceType,
      referenceId:
        mongoose.Types.ObjectId.isValid(referenceId) && String(new mongoose.Types.ObjectId(referenceId)) === String(referenceId)
          ? new mongoose.Types.ObjectId(referenceId)
          : referenceId,
    }).sort({ createdAt: 1 });
    if (activeSession) query.session(activeSession);
    return await query;
  }

  /**
   * Fetch paginated financial ledger history using an efficient $facet aggregation pipeline.
   * @param {string|mongoose.Types.ObjectId} orgId
   * @param {object} filters
   * @param {object} options
   */
  async getFinancialHistory(orgId, filters = {}, options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.max(1, parseInt(options.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const matchStage = {
      orgId: new mongoose.Types.ObjectId(orgId),
    };

    if (filters.domain) matchStage.domain = filters.domain;
    if (filters.status) matchStage.status = filters.status;
    if (filters.userId) matchStage.userId = new mongoose.Types.ObjectId(filters.userId);
    if (filters.account) {
      matchStage.$or = [{ debitAccount: filters.account }, { creditAccount: filters.account }];
    }
    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      matchStage.amount = {};
      if (filters.minAmount !== undefined) matchStage.amount.$gte = Number(filters.minAmount);
      if (filters.maxAmount !== undefined) matchStage.amount.$lte = Number(filters.maxAmount);
    }

    const sortStage = { createdAt: options.sortOrder === 'asc' ? 1 : -1 };

    const pipeline = [
      { $match: matchStage },
      { $sort: sortStage },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const results = await FinancialLedgerEntry.aggregate(pipeline);
    const totalRecords = results[0]?.metadata[0]?.total || 0;
    const entries = results[0]?.data || [];

    return {
      entries,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  /**
   * Aggregate debits and credits per account for trial balance / account totals.
   */
  async getAccountBalances(orgId) {
    const pipeline = [
      { $match: { orgId: new mongoose.Types.ObjectId(orgId), status: 'POSTED' } },
      { $unwind: '$entries' },
      {
        $group: {
          _id: { account: '$entries.account', entryType: '$entries.entryType' },
          total: { $sum: '$entries.amount' },
        },
      },
    ];

    const aggregated = await FinancialLedgerEntry.aggregate(pipeline);

    const balances = {};
    for (const row of aggregated) {
      const { account, entryType } = row._id;
      if (!balances[account]) balances[account] = { debits: 0, credits: 0, net: 0 };
      if (entryType === 'DEBIT') balances[account].debits += row.total;
      if (entryType === 'CREDIT') balances[account].credits += row.total;
      balances[account].net = balances[account].debits - balances[account].credits;
    }

    return balances;
  }
}

export const financialLedgerRepository = new FinancialLedgerRepository();
export default financialLedgerRepository;
