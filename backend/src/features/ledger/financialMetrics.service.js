import mongoose from 'mongoose';
import Payment from '../payment/payment.model.js';
import { Wallet, WalletTransaction } from '../wallet/wallet.model.js';
import FinancialLedgerEntry from './financialLedgerEntry.model.js';
import ReconciliationException from './reconciliation/models/reconciliationException.model.js';
import WalletLedger from '../wallet/walletLedger.model.js';
import Ledger from './ledger.model.js';
import { financialFeatureFlags } from '../../config/financialFeatureFlags.js';
import { ENTRY_TYPES, FINANCIAL_ACCOUNTS } from './financialLedger.constants.js';
import logger from '../../utils/logger.utils.js';

export class FinancialMetricsService {
  /**
   * Retrieve real-time operational financial health metrics for an organization or globally.
   *
   * @param {string|mongoose.Types.ObjectId|null} [orgId]
   * @returns {Promise<object>} Comprehensive operational financial metrics
   */
  async getMetrics(orgId = null) {
    try {
      const orgFilter = orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {};

      // 1. Payment Metrics Aggregation
      const paymentStatsPromise = Payment.aggregate([
        { $match: { ...orgFilter, isDeleted: false } },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            successCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['success', 'PAID']] }, 1, 0],
              },
            },
            pendingCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['pending', 'created', 'PENDING']] }, 1, 0],
              },
            },
            failedCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['failed', 'FAILED']] }, 1, 0],
              },
            },
            refundedCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['refunded', 'partially_refunded']] }, 1, 0],
              },
            },
            totalSuccessVolume: {
              $sum: {
                $cond: [{ $in: ['$status', ['success', 'PAID']] }, '$amount', 0],
              },
            },
          },
        },
      ]);

      const domainStatsPromise = Payment.aggregate([
        { $match: { ...orgFilter, isDeleted: false } },
        {
          $group: {
            _id: '$domain',
            count: { $sum: 1 },
            volume: { $sum: '$amount' },
          },
        },
      ]);

      // 2. Ledger Metrics Aggregation (Zero-sum double-entry balance check)
      const ledgerCountPromise = FinancialLedgerEntry.countDocuments(orgFilter);

      const ledgerStatsPromise = FinancialLedgerEntry.aggregate([
        { $match: orgFilter },
        { $unwind: '$entries' },
        {
          $group: {
            _id: '$entries.entryType',
            totalAmount: { $sum: '$entries.amount' },
            count: { $sum: 1 },
          },
        },
      ]);

      const ledgerAccountStatsPromise = FinancialLedgerEntry.aggregate([
        { $match: orgFilter },
        { $unwind: '$entries' },
        {
          $group: {
            _id: { account: '$entries.account', entryType: '$entries.entryType' },
            totalAmount: { $sum: '$entries.amount' },
            count: { $sum: 1 },
          },
        },
      ]);

      // 3. Wallet Metrics Aggregation
      const walletStatsPromise = Wallet.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: null,
            totalWallets: { $sum: 1 },
            totalCirculatingBalance: { $sum: '$balance' },
            negativeBalanceCount: {
              $sum: {
                $cond: [{ $lt: ['$balance', 0] }, 1, 0],
              },
            },
          },
        },
      ]);

      const walletTxnStatsPromise = WalletTransaction.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      // 4. Reconciliation Exception Queue
      const exceptionStatsPromise = ReconciliationException.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      // 5. Legacy Storage Counts (Read-Only)
      const legacyWalletLedgerPromise = WalletLedger.countDocuments(orgFilter).catch(() => 0);
      const legacyLedgerPromise = Ledger.countDocuments(orgFilter).catch(() => 0);

      // Execute aggregations concurrently
      const [
        paymentStatsRes,
        domainStatsRes,
        totalLedgerEntries,
        ledgerStatsRes,
        ledgerAccountRes,
        walletStatsRes,
        walletTxnRes,
        exceptionStatsRes,
        legacyWalletLedgerCount,
        legacyLedgerCount,
      ] = await Promise.all([
        paymentStatsPromise,
        domainStatsPromise,
        ledgerCountPromise,
        ledgerStatsPromise,
        ledgerAccountStatsPromise,
        walletStatsPromise,
        walletTxnStatsPromise,
        exceptionStatsPromise,
        legacyWalletLedgerPromise,
        legacyLedgerPromise,
      ]);

      // Process Payment summary
      const pStats = paymentStatsRes[0] || {
        totalPayments: 0,
        successCount: 0,
        pendingCount: 0,
        failedCount: 0,
        refundedCount: 0,
        totalSuccessVolume: 0,
      };

      const domainBreakdown = {};
      for (const d of domainStatsRes) {
        domainBreakdown[d._id || 'UNKNOWN'] = {
          count: d.count,
          volume: Math.round(d.volume * 100) / 100,
        };
      }

      // Process Ledger zero-sum double-entry balance
      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of ledgerStatsRes) {
        if (entry._id === ENTRY_TYPES.DEBIT) {
          totalDebits = Math.round(entry.totalAmount * 100) / 100;
        } else if (entry._id === ENTRY_TYPES.CREDIT) {
          totalCredits = Math.round(entry.totalAmount * 100) / 100;
        }
      }

      const imbalance = Math.abs(Math.round((totalDebits - totalCredits) * 100) / 100);
      const isBalanced = imbalance === 0;

      const accountBalances = {};
      for (const acc of ledgerAccountRes) {
        const accountName = acc._id.account;
        const entryType = acc._id.entryType;
        if (!accountBalances[accountName]) {
          accountBalances[accountName] = { debits: 0, credits: 0, net: 0, count: 0 };
        }
        if (entryType === ENTRY_TYPES.DEBIT) {
          accountBalances[accountName].debits += Math.round(acc.totalAmount * 100) / 100;
        } else if (entryType === ENTRY_TYPES.CREDIT) {
          accountBalances[accountName].credits += Math.round(acc.totalAmount * 100) / 100;
        }
        accountBalances[accountName].count += acc.count;
        accountBalances[accountName].net =
          Math.round((accountBalances[accountName].debits - accountBalances[accountName].credits) * 100) / 100;
      }

      // Process Wallet summary
      const wStats = walletStatsRes[0] || {
        totalWallets: 0,
        totalCirculatingBalance: 0,
        negativeBalanceCount: 0,
      };

      const walletTxnBreakdown = {};
      let totalWalletTransactions = 0;
      for (const tx of walletTxnRes) {
        totalWalletTransactions += tx.count;
        walletTxnBreakdown[tx._id || 'unknown'] = {
          count: tx.count,
          totalAmount: Math.round(tx.totalAmount * 100) / 100,
        };
      }

      // Process Exception Queue
      const exceptionBreakdown = {
        total: 0,
        open: 0,
        under_review: 0,
        resolved: 0,
        dismissed: 0,
      };
      for (const ex of exceptionStatsRes) {
        exceptionBreakdown[ex._id] = ex.count;
        exceptionBreakdown.total += ex.count;
      }

      // Overall health rating
      let overallStatus = 'HEALTHY';
      if (!isBalanced || wStats.negativeBalanceCount > 0) {
        overallStatus = 'DEGRADED';
      } else if (exceptionBreakdown.open > 0) {
        overallStatus = 'ATTENTION_REQUIRED';
      }

      return {
        timestamp: new Date(),
        orgId: orgId ? orgId.toString() : 'ALL',
        overallStatus,
        payments: {
          total: pStats.totalPayments,
          success: pStats.successCount,
          pending: pStats.pendingCount,
          failed: pStats.failedCount,
          refunded: pStats.refundedCount,
          totalSuccessVolume: Math.round(pStats.totalSuccessVolume * 100) / 100,
          domains: domainBreakdown,
        },
        ledger: {
          totalEntries: totalLedgerEntries,
          totalDebits,
          totalCredits,
          imbalance,
          isBalanced,
          accountBalances,
        },
        wallets: {
          totalWallets: wStats.totalWallets,
          totalCirculatingBalance: Math.round(wStats.totalCirculatingBalance * 100) / 100,
          negativeBalanceCount: wStats.negativeBalanceCount,
          transactions: {
            total: totalWalletTransactions,
            byStatus: walletTxnBreakdown,
          },
        },
        reconciliationQueue: exceptionBreakdown,
        legacyStorage: {
          walletLedgerHistoricalCount: legacyWalletLedgerCount,
          ledgerHistoricalCount: legacyLedgerCount,
          writeProtectionEnforced: true,
          notice: 'Legacy models are read-only for audit preservation. Writes throw deprecation errors.',
        },
        featureFlags: financialFeatureFlags.getAll(),
      };
    } catch (error) {
      logger.error('Failed to compute financial metrics:', { error: error.message, orgId });
      throw error;
    }
  }
}

export const financialMetricsService = new FinancialMetricsService();
export default financialMetricsService;
