import mongoose from 'mongoose';
import Payment from '../payment/payment.model.js';
import { Wallet, WalletTransaction } from '../wallet/wallet.model.js';
import FinancialLedgerEntry from './financialLedgerEntry.model.js';
import Invoice from '../invoice/invoice.model.js';
import AmenityBooking from '../amenityBooking/amenityBooking.model.js';
import ReconciliationException from './reconciliation/models/reconciliationException.model.js';
import { FINANCIAL_ACCOUNTS, ENTRY_TYPES } from './financialLedger.constants.js';
import logger from '../../utils/logger.utils.js';

export class FinancialIntegrityService {
  /**
   * Run comprehensive read-only financial integrity audit for an organization or globally.
   *
   * @param {string|mongoose.Types.ObjectId|null} [orgId]
   * @returns {Promise<object>} Integrity report
   */
  async runIntegrityCheck(orgId = null) {
    const orgFilter = orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {};
    const invoiceFilter = orgId ? { orgId: new mongoose.Types.ObjectId(orgId), isDeleted: false } : { isDeleted: false };

    const diagnostics = {
      timestamp: new Date(),
      orgId: orgId ? orgId.toString() : 'ALL',
      status: 'PASS',
      suites: {
        Payments: 'PASS',
        Wallets: 'PASS',
        WalletTransactions: 'PASS',
        Ledger: 'PASS',
        Invoices: 'PASS',
        Amenity: 'PASS',
        Reconciliation: 'PASS',
        TenantIsolation: 'PASS',
      },
      details: {
        payments: [],
        wallets: [],
        walletTransactions: [],
        ledger: [],
        invoices: [],
        amenity: [],
        reconciliation: [],
        tenantIsolation: [],
      },
      summary: {
        totalChecks: 8,
        passedChecks: 0,
        failedChecks: 0,
      },
    };

    // 1. Audit Payments
    const payments = await Payment.find({ ...orgFilter, isDeleted: false }).lean();
    for (const p of payments) {
      if (p.status === 'success' || p.status === 'PAID') {
        const ledger = await FinancialLedgerEntry.findOne({
          $or: [
            { paymentId: p._id },
            { referenceId: p._id },
            { idempotencyKey: `HISTORICAL:Payment:${p._id}:LEDGER` },
            { idempotencyKey: `${p._id.toString()}:SETTLEMENT` },
          ],
        }).lean();

        if (!ledger) {
          diagnostics.details.payments.push({
            type: 'PAYMENT_WITHOUT_LEDGER',
            paymentId: p._id.toString(),
            amount: p.amount,
            domain: p.domain,
            referenceType: p.referenceType,
            referenceId: p.referenceId?.toString(),
            message: `Settled payment ${p._id} has no matching posted FinancialLedgerEntry`,
          });
        }
      }
    }
    if (diagnostics.details.payments.length > 0) diagnostics.suites.Payments = 'FAIL';

    // 2. Audit Wallets
    const wallets = await Wallet.find(orgFilter).lean();
    for (const w of wallets) {
      if (Number(w.balance || 0) < 0) {
        diagnostics.details.wallets.push({
          type: 'NEGATIVE_WALLET_BALANCE',
          walletId: w._id.toString(),
          userId: w.userId.toString(),
          balance: w.balance,
          message: `Wallet ${w._id} has forbidden negative balance ₹${w.balance}`,
        });
      }
    }
    if (diagnostics.details.wallets.length > 0) diagnostics.suites.Wallets = 'FAIL';

    // 3. Audit Wallet Transactions
    const walletTxns = await WalletTransaction.find(orgFilter).lean();
    for (const txn of walletTxns) {
      if (txn.paymentStatus === 'success') {
        if (!txn.userId || !txn.amount || txn.amount <= 0) {
          diagnostics.details.walletTransactions.push({
            type: 'INVALID_WALLET_TXN',
            transactionId: txn.transactionId || txn._id.toString(),
            message: `Wallet transaction has invalid amount or missing user reference`,
          });
        }
      }
    }
    if (diagnostics.details.walletTransactions.length > 0) diagnostics.suites.WalletTransactions = 'FAIL';

    // 4. Audit Financial Ledger
    const ledgerEntries = await FinancialLedgerEntry.find(orgFilter).lean();
    let globalDebits = 0;
    let globalCredits = 0;
    const seenIdempotencyKeys = new Set();

    for (const entry of ledgerEntries) {
      // Check duplicate idempotency keys
      if (seenIdempotencyKeys.has(entry.idempotencyKey)) {
        diagnostics.details.ledger.push({
          type: 'DUPLICATE_IDEMPOTENCY_KEY',
          transactionId: entry.transactionId,
          idempotencyKey: entry.idempotencyKey,
          message: `Duplicate ledger idempotency key detected: ${entry.idempotencyKey}`,
        });
      }
      seenIdempotencyKeys.add(entry.idempotencyKey);

      let entryDebit = 0;
      let entryCredit = 0;

      for (const line of entry.entries || []) {
        const amt = Number(line.amount || 0);
        if (amt <= 0) {
          diagnostics.details.ledger.push({
            type: 'NON_POSITIVE_AMOUNT',
            transactionId: entry.transactionId,
            amount: amt,
            message: `Ledger entry contains non-positive line amount: ${amt}`,
          });
        }

        if (line.entryType === ENTRY_TYPES.DEBIT) {
          entryDebit += amt;
          globalDebits += amt;
        } else if (line.entryType === ENTRY_TYPES.CREDIT) {
          entryCredit += amt;
          globalCredits += amt;
        }
      }

      if (Math.round(entryDebit * 100) !== Math.round(entryCredit * 100)) {
        diagnostics.details.ledger.push({
          type: 'UNBALANCED_ENTRY',
          transactionId: entry.transactionId,
          debits: entryDebit,
          credits: entryCredit,
          message: `Ledger entry debits (₹${entryDebit}) do not balance credits (₹${entryCredit})`,
        });
      }
    }

    if (Math.round(globalDebits * 100) !== Math.round(globalCredits * 100)) {
      diagnostics.details.ledger.push({
        type: 'GLOBAL_LEDGER_IMBALANCE',
        totalDebits: globalDebits,
        totalCredits: globalCredits,
        difference: Math.abs(globalDebits - globalCredits),
        message: `Global ledger debits (₹${globalDebits}) do not equal credits (₹${globalCredits})`,
      });
    }
    if (diagnostics.details.ledger.length > 0) diagnostics.suites.Ledger = 'FAIL';

    // 5. Audit Invoices
    const invoices = await Invoice.find(invoiceFilter).lean();
    for (const inv of invoices) {
      const total = Number(inv.totalAmount || 0);
      const paid = Number(inv.paidAmount || 0);
      const outstanding = Number(inv.outstandingAmount || 0);

      // Check math consistency: total == paid + outstanding (within rounding)
      if (Math.abs(total - (paid + outstanding)) > 0.05) {
        diagnostics.details.invoices.push({
          type: 'INVOICE_BALANCE_MISMATCH',
          invoiceId: inv._id.toString(),
          invoiceNumber: inv.invoiceNumber,
          total,
          paid,
          outstanding,
          message: `Invoice amounts do not balance: total (${total}) != paid (${paid}) + outstanding (${outstanding})`,
        });
      }
    }
    if (diagnostics.details.invoices.length > 0) diagnostics.suites.Invoices = 'FAIL';

    // 6. Audit Amenity Bookings
    const bookings = await AmenityBooking.find(orgFilter).lean();
    for (const b of bookings) {
      if ((b.paymentStatus === 'success' || b.paymentStatus === 'captured') && !b.paymentId) {
        diagnostics.details.amenity.push({
          type: 'SETTLED_BOOKING_WITHOUT_PAYMENT_REF',
          bookingId: b._id.toString(),
          bookingNumber: b.bookingId,
          message: `Amenity booking is marked paid but lacks canonical paymentId link`,
        });
      }
    }
    if (diagnostics.details.amenity.length > 0) diagnostics.suites.Amenity = 'FAIL';

    // 7. Audit Reconciliation Exceptions
    const openExceptions = await ReconciliationException.find({ ...orgFilter, status: 'OPEN' }).lean();
    if (openExceptions.length > 0) {
      for (const exc of openExceptions) {
        diagnostics.details.reconciliation.push({
          type: 'UNRESOLVED_RECONCILIATION_EXCEPTION',
          exceptionId: exc._id.toString(),
          classification: exc.classification,
          sourceType: exc.sourceType,
          sourceId: exc.sourceId?.toString(),
          reason: exc.reason,
        });
      }
      diagnostics.suites.Reconciliation = 'FAIL';
    }

    // 8. Audit Tenant Isolation
    for (const p of payments) {
      if (!p.orgId) {
        diagnostics.details.tenantIsolation.push({
          type: 'MISSING_PAYMENT_ORG_ID',
          paymentId: p._id.toString(),
          message: `Payment record ${p._id} lacks mandatory tenant orgId`,
        });
      }
    }
    for (const l of ledgerEntries) {
      if (!l.orgId) {
        diagnostics.details.tenantIsolation.push({
          type: 'MISSING_LEDGER_ORG_ID',
          transactionId: l.transactionId,
          message: `FinancialLedgerEntry lacks mandatory tenant orgId`,
        });
      }
    }
    if (diagnostics.details.tenantIsolation.length > 0) diagnostics.suites.TenantIsolation = 'FAIL';

    // Compute summary
    let passed = 0;
    let failed = 0;
    for (const suite of Object.values(diagnostics.suites)) {
      if (suite === 'PASS') passed++;
      else failed++;
    }
    diagnostics.summary.passedChecks = passed;
    diagnostics.summary.failedChecks = failed;
    diagnostics.status = failed === 0 ? 'PASS' : 'FAIL';

    return diagnostics;
  }
}

export const financialIntegrityService = new FinancialIntegrityService();
export default financialIntegrityService;
