import mongoose from 'mongoose';
import Organization from '../../organization/organization.model.js';
import Invoice from '../../invoice/invoice.model.js';
import AmenityBooking from '../../amenityBooking/amenityBooking.model.js';
import { Wallet, WalletTransaction } from '../../wallet/wallet.model.js';
import Payment from '../../payment/payment.model.js';
import FinancialLedgerEntry from '../financialLedgerEntry.model.js';
import ReconciliationException from './models/reconciliationException.model.js';
import logger from '../../../utils/logger.utils.js';

export class HistoricalInventoryService {
  /**
   * Gather full financial inventory for a single tenant or all tenants.
   * @param {string|mongoose.Types.ObjectId|null} [targetOrgId]
   * @returns {Promise<object>} Full inventory report
   */
  async getInventory(targetOrgId = null) {
    const orgFilter = targetOrgId ? { _id: new mongoose.Types.ObjectId(targetOrgId) } : {};
    const orgs = await Organization.find(orgFilter).select('_id name code status isDeleted').lean();

    const tenantInventories = [];
    const globalSummary = {
      tenantCount: orgs.length,
      invoices: { total: 0, paid: 0, partiallyPaid: 0, unpaid: 0, totalAmount: 0, paidAmount: 0 },
      amenityBookings: { total: 0, settled: 0, pending: 0, refunded: 0, totalAmount: 0 },
      wallets: { total: 0, totalBalance: 0, positiveCount: 0 },
      walletTransactions: { total: 0, creditCount: 0, creditAmount: 0, debitCount: 0, debitAmount: 0 },
      payments: { total: 0, successCount: 0, successAmount: 0, backfillCount: 0 },
      financialLedgerEntries: { total: 0, totalDebits: 0, totalCredits: 0, isBalanced: true },
      exceptions: { total: 0, open: 0, resolved: 0 },
    };

    for (const org of orgs) {
      const orgId = org._id;

      // 1. Invoices
      const invoiceDocs = await Invoice.find({ orgId, isDeleted: false }).lean();
      const invSummary = {
        total: invoiceDocs.length,
        byStatus: {},
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        paidCount: 0,
        unpaidCount: 0,
        partiallyPaidCount: 0,
      };

      for (const inv of invoiceDocs) {
        invSummary.byStatus[inv.status] = (invSummary.byStatus[inv.status] || 0) + 1;
        invSummary.totalAmount += Number(inv.totalAmount || 0);
        invSummary.paidAmount += Number(inv.paidAmount || 0);
        invSummary.outstandingAmount += Number(inv.outstandingAmount || 0);

        if (inv.status === 'PAID') invSummary.paidCount++;
        else if (inv.status === 'UNPAID') invSummary.unpaidCount++;
        else if (inv.status === 'PARTIALLY_PAID') invSummary.partiallyPaidCount++;
      }

      // 2. Amenity Bookings
      const bookingDocs = await AmenityBooking.find({ orgId }).lean();
      const bookingSummary = {
        total: bookingDocs.length,
        byPaymentStatus: {},
        settledCount: 0,
        totalAmount: 0,
        refundAmount: 0,
      };

      for (const b of bookingDocs) {
        const pStatus = b.paymentStatus || 'pending';
        bookingSummary.byPaymentStatus[pStatus] = (bookingSummary.byPaymentStatus[pStatus] || 0) + 1;
        const total = Number(b.pricingDetails?.totalAmount || 0);
        const refund = Number(b.pricingDetails?.refundAmount || 0);
        bookingSummary.totalAmount += total;
        bookingSummary.refundAmount += refund;

        if (pStatus === 'captured' || pStatus === 'success') {
          bookingSummary.settledCount++;
        }
      }

      // 3. Wallets
      const walletDocs = await Wallet.find({ orgId }).lean();
      const walletSummary = {
        total: walletDocs.length,
        totalBalance: 0,
        positiveCount: 0,
        zeroCount: 0,
      };

      for (const w of walletDocs) {
        const bal = Number(w.balance || 0);
        walletSummary.totalBalance += bal;
        if (bal > 0) walletSummary.positiveCount++;
        else walletSummary.zeroCount++;
      }

      // 4. Wallet Transactions
      const txnDocs = await WalletTransaction.find({ orgId }).lean();
      const txnSummary = {
        total: txnDocs.length,
        creditCount: 0,
        creditAmount: 0,
        debitCount: 0,
        debitAmount: 0,
        byReferenceType: {},
      };

      for (const t of txnDocs) {
        const amt = Number(t.amount || 0);
        if (t.type === 'Credit') {
          txnSummary.creditCount++;
          txnSummary.creditAmount += amt;
        } else if (t.type === 'Debit') {
          txnSummary.debitCount++;
          txnSummary.debitAmount += amt;
        }
        const refType = t.referenceType || 'Other';
        txnSummary.byReferenceType[refType] = (txnSummary.byReferenceType[refType] || 0) + 1;
      }

      // 5. Payments
      const paymentDocs = await Payment.find({ orgId, isDeleted: false }).lean();
      const paymentSummary = {
        total: paymentDocs.length,
        byStatus: {},
        byDomain: {},
        successCount: 0,
        successAmount: 0,
        backfillCount: 0,
      };

      for (const p of paymentDocs) {
        paymentSummary.byStatus[p.status] = (paymentSummary.byStatus[p.status] || 0) + 1;
        const dom = p.domain || 'OTHER';
        paymentSummary.byDomain[dom] = (paymentSummary.byDomain[dom] || 0) + 1;

        if (p.status === 'success' || p.status === 'PAID') {
          paymentSummary.successCount++;
          paymentSummary.successAmount += Number(p.amount || 0);
        }
        if (p.metadata?.isHistoricalBackfill) {
          paymentSummary.backfillCount++;
        }
      }

      // 6. Financial Ledger Entries
      const ledgerDocs = await FinancialLedgerEntry.find({ orgId }).lean();
      const ledgerSummary = {
        total: ledgerDocs.length,
        byDomain: {},
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: true,
      };

      for (const l of ledgerDocs) {
        const dom = l.domain || 'OTHER';
        ledgerSummary.byDomain[dom] = (ledgerSummary.byDomain[dom] || 0) + 1;

        for (const line of l.entries || []) {
          if (line.entryType === 'DEBIT') ledgerSummary.totalDebits += Number(line.amount || 0);
          if (line.entryType === 'CREDIT') ledgerSummary.totalCredits += Number(line.amount || 0);
        }
      }
      ledgerSummary.isBalanced = Math.abs(ledgerSummary.totalDebits - ledgerSummary.totalCredits) < 0.01;

      // 7. Exceptions
      const exceptionDocs = await ReconciliationException.find({ orgId }).lean();
      const exceptionSummary = {
        total: exceptionDocs.length,
        byStatus: {},
        byClassification: {},
        openCount: 0,
      };

      for (const exc of exceptionDocs) {
        exceptionSummary.byStatus[exc.status] = (exceptionSummary.byStatus[exc.status] || 0) + 1;
        exceptionSummary.byClassification[exc.classification] = (exceptionSummary.byClassification[exc.classification] || 0) + 1;
        if (exc.status === 'OPEN') exceptionSummary.openCount++;
      }

      // Tenant Result
      const tenantData = {
        orgId: org._id.toString(),
        name: org.name,
        code: org.code,
        invoices: invSummary,
        amenityBookings: bookingSummary,
        wallets: walletSummary,
        walletTransactions: txnSummary,
        payments: paymentSummary,
        financialLedger: ledgerSummary,
        exceptions: exceptionSummary,
      };

      tenantInventories.push(tenantData);

      // Accumulate Global
      globalSummary.invoices.total += invSummary.total;
      globalSummary.invoices.paid += invSummary.paidCount;
      globalSummary.invoices.partiallyPaid += invSummary.partiallyPaidCount;
      globalSummary.invoices.unpaid += invSummary.unpaidCount;
      globalSummary.invoices.totalAmount += invSummary.totalAmount;
      globalSummary.invoices.paidAmount += invSummary.paidAmount;

      globalSummary.amenityBookings.total += bookingSummary.total;
      globalSummary.amenityBookings.settled += bookingSummary.settledCount;
      globalSummary.amenityBookings.totalAmount += bookingSummary.totalAmount;

      globalSummary.wallets.total += walletSummary.total;
      globalSummary.wallets.totalBalance += walletSummary.totalBalance;
      globalSummary.wallets.positiveCount += walletSummary.positiveCount;

      globalSummary.walletTransactions.total += txnSummary.total;
      globalSummary.walletTransactions.creditCount += txnSummary.creditCount;
      globalSummary.walletTransactions.creditAmount += txnSummary.creditAmount;
      globalSummary.walletTransactions.debitCount += txnSummary.debitCount;
      globalSummary.walletTransactions.debitAmount += txnSummary.debitAmount;

      globalSummary.payments.total += paymentSummary.total;
      globalSummary.payments.successCount += paymentSummary.successCount;
      globalSummary.payments.successAmount += paymentSummary.successAmount;
      globalSummary.payments.backfillCount += paymentSummary.backfillCount;

      globalSummary.financialLedgerEntries.total += ledgerSummary.total;
      globalSummary.financialLedgerEntries.totalDebits += ledgerSummary.totalDebits;
      globalSummary.financialLedgerEntries.totalCredits += ledgerSummary.totalCredits;

      globalSummary.exceptions.total += exceptionSummary.total;
      globalSummary.exceptions.open += exceptionSummary.openCount;
    }

    globalSummary.financialLedgerEntries.isBalanced =
      Math.abs(globalSummary.financialLedgerEntries.totalDebits - globalSummary.financialLedgerEntries.totalCredits) < 0.01;

    return {
      timestamp: new Date(),
      globalSummary,
      tenants: tenantInventories,
    };
  }
}

export const historicalInventoryService = new HistoricalInventoryService();
export default historicalInventoryService;
