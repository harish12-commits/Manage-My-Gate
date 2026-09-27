import mongoose from 'mongoose';
import FinancialLedgerEntry from '../financialLedgerEntry.model.js';
import { FINANCIAL_ACCOUNTS, ENTRY_TYPES } from '../financialLedger.constants.js';
import Payment from '../../payment/payment.model.js';
import { Wallet } from '../../wallet/wallet.model.js';
import ReconciliationException from './models/reconciliationException.model.js';
import HistoricalMigrationRun from './models/historicalMigrationRun.model.js';
import logger from '../../../utils/logger.utils.js';

export class ReconciliationReportService {
  /**
   * Run read-only verification of all financial accounting invariants for a tenant (or globally).
   * @param {string|mongoose.Types.ObjectId|null} [orgId]
   * @returns {Promise<object>} Audit & Invariants Verification Report
   */
  async verifyFinancialInvariants(orgId = null) {
    const query = orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {};
    const violations = [];

    // --- Invariant 1: Per-entry and global double-entry balance ---
    const ledgerEntries = await FinancialLedgerEntry.find(query).lean();
    let totalDebitSum = 0;
    let totalCreditSum = 0;
    const accountTotals = {};

    for (const entry of ledgerEntries) {
      let entryDebit = 0;
      let entryCredit = 0;

      for (const line of entry.entries || []) {
        const amt = Number(line.amount || 0);

        // Check for non-positive amounts
        if (amt <= 0) {
          violations.push({
            rule: 'NON_POSITIVE_AMOUNT',
            severity: 'CRITICAL',
            details: `Ledger entry line has invalid non-positive amount ${amt}`,
            affectedId: entry._id.toString(),
            transactionId: entry.transactionId,
          });
        }

        // Account accumulation
        if (!accountTotals[line.account]) {
          accountTotals[line.account] = { debits: 0, credits: 0, balance: 0 };
        }

        if (line.entryType === ENTRY_TYPES.DEBIT) {
          entryDebit += amt;
          totalDebitSum += amt;
          accountTotals[line.account].debits += amt;
        } else if (line.entryType === ENTRY_TYPES.CREDIT) {
          entryCredit += amt;
          totalCreditSum += amt;
          accountTotals[line.account].credits += amt;
        }
      }

      // Check per-entry balance
      const roundedEntryDebit = Math.round(entryDebit * 100);
      const roundedEntryCredit = Math.round(entryCredit * 100);
      if (roundedEntryDebit !== roundedEntryCredit) {
        violations.push({
          rule: 'ENTRY_UNBALANCED',
          severity: 'CRITICAL',
          details: `Entry debits (${entryDebit}) do not equal credits (${entryCredit})`,
          affectedId: entry._id.toString(),
          transactionId: entry.transactionId,
        });
      }
    }

    // Global balance check
    const roundedTotalDebit = Math.round(totalDebitSum * 100);
    const roundedTotalCredit = Math.round(totalCreditSum * 100);
    const isGlobalBalanced = roundedTotalDebit === roundedTotalCredit;
    if (!isGlobalBalanced) {
      violations.push({
        rule: 'GLOBAL_DOUBLE_ENTRY_UNBALANCED',
        severity: 'CRITICAL',
        details: `Global debit sum (${totalDebitSum}) != credit sum (${totalCreditSum})`,
        difference: Math.abs(totalDebitSum - totalCreditSum),
      });
    }

    // Calculate account net balances
    for (const acc of Object.keys(accountTotals)) {
      accountTotals[acc].balance = Math.round((accountTotals[acc].credits - accountTotals[acc].debits) * 100) / 100;
    }

    // --- Invariant 2: Settled Payment completeness check ---
    const paymentQuery = orgId ? { orgId, status: { $in: ['success', 'PAID'] }, isDeleted: false } : { status: { $in: ['success', 'PAID'] }, isDeleted: false };
    const settledPayments = await Payment.find(paymentQuery).lean();

    for (const payment of settledPayments) {
      const hasLedger = ledgerEntries.some(
        (l) => (l.paymentId && l.paymentId.toString() === payment._id.toString()) ||
               (l.referenceId && l.referenceId.toString() === payment._id.toString())
      );
      if (!hasLedger) {
        violations.push({
          rule: 'PAYMENT_MISSING_LEDGER',
          severity: 'HIGH',
          details: `Settled payment ${payment._id} of amount ₹${payment.amount} has no posted financial ledger entry`,
          affectedId: payment._id.toString(),
        });
      }
    }

    // --- Invariant 3: Wallet balance vs Ledger Resident Wallet account ---
    const walletQuery = orgId ? { orgId } : {};
    const wallets = await Wallet.find(walletQuery).lean();

    for (const wallet of wallets) {
      const walletLedgerEntries = ledgerEntries.filter(
        (l) => l.userId && l.userId.toString() === wallet.userId.toString()
      );

      let walletCredits = 0;
      let walletDebits = 0;

      for (const entry of walletLedgerEntries) {
        for (const line of entry.entries || []) {
          if (line.account === FINANCIAL_ACCOUNTS.RESIDENT_WALLET) {
            if (line.entryType === ENTRY_TYPES.CREDIT) walletCredits += Number(line.amount || 0);
            if (line.entryType === ENTRY_TYPES.DEBIT) walletDebits += Number(line.amount || 0);
          }
        }
      }

      const calculatedWalletBalance = Math.round((walletCredits - walletDebits) * 100) / 100;
      const storedBalance = Math.round(Number(wallet.balance || 0) * 100) / 100;

      // Note: If wallet has no ledger entries yet (prior to backfill/genesis), it may differ
      if (Math.abs(calculatedWalletBalance - storedBalance) > 0.01) {
        violations.push({
          rule: 'WALLET_LEDGER_MISMATCH',
          severity: 'MEDIUM',
          details: `Wallet balance (₹${storedBalance}) differs from ledger balance (₹${calculatedWalletBalance})`,
          affectedId: wallet._id.toString(),
          userId: wallet.userId.toString(),
          storedBalance,
          calculatedBalance: calculatedWalletBalance,
          variance: Math.round((storedBalance - calculatedWalletBalance) * 100) / 100,
        });
      }
    }

    // Open exceptions count
    const excQuery = orgId ? { orgId, status: 'OPEN' } : { status: 'OPEN' };
    const openExceptionsCount = await ReconciliationException.countDocuments(excQuery);

    const invariantsPassed = violations.filter((v) => v.severity === 'CRITICAL').length === 0;

    return {
      timestamp: new Date(),
      orgId: orgId ? orgId.toString() : 'ALL',
      invariantsPassed,
      isClean: violations.length === 0,
      totalEntries: ledgerEntries.length,
      totalDebits: totalDebitSum,
      totalCredits: totalCreditSum,
      isBalanced: isGlobalBalanced,
      accountTotals,
      violationsCount: violations.length,
      criticalViolationsCount: violations.filter((v) => v.severity === 'CRITICAL').length,
      openExceptionsCount,
      violations,
    };
  }

  /**
   * Retrieve report and audit trail for a migration run.
   */
  async getRunReport(runId) {
    const run = await HistoricalMigrationRun.findOne({ runId }).lean();
    if (!run) return null;

    const exceptions = await ReconciliationException.find({ runId }).lean();
    return {
      run,
      exceptions,
    };
  }
}

export const reconciliationReportService = new ReconciliationReportService();
export default reconciliationReportService;
