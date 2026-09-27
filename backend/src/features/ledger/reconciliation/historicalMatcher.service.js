import mongoose from 'mongoose';
import Payment from '../../payment/payment.model.js';
import { WalletTransaction } from '../../wallet/wallet.model.js';
import FinancialLedgerEntry from '../financialLedgerEntry.model.js';
import { RECONCILIATION_CLASSIFICATIONS } from './reconciliation.constants.js';

export class HistoricalMatcherService {
  /**
   * Deterministically match an invoice or booking against existing canonical financial entities.
   * Priority hierarchy:
   * 1. Exact paymentId
   * 2. Exact gatewayTransactionId / gatewayOrderId
   * 3. Explicit domain reference (referenceType, referenceId)
   * 4. Explicit WalletTransaction reference
   * 5. Conservative composite matching (orgId, userId, amount, paymentMethod)
   *
   * @param {object} source - The source document (Invoice or AmenityBooking)
   * @param {string} domainType - 'Invoice' | 'AmenityBooking'
   * @returns {Promise<object>} Match result
   */
  async matchRecord(source, domainType) {
    const orgId = source.orgId || source.communityId;
    const sourceId = source._id;
    const amount = Number(
      domainType === 'Invoice'
        ? source.paidAmount || source.totalAmount
        : source.pricingDetails?.totalAmount || source.totalAmount || 0
    );
    const userId = source.targetUserId || source.userId;

    // --- Priority 1: Exact paymentId ---
    if (source.paymentId) {
      let payment = null;
      if (mongoose.Types.ObjectId.isValid(source.paymentId)) {
        payment = await Payment.findOne({
          _id: new mongoose.Types.ObjectId(source.paymentId),
          orgId,
          isDeleted: false,
        }).lean();
      }
      if (!payment) {
        payment = await Payment.findOne({
          gatewayTransactionId: source.paymentId,
          orgId,
          isDeleted: false,
        }).lean();
      }
      if (payment) {
        const ledgerEntries = await this.findLedgerEntries(domainType, sourceId, payment._id);
        return {
          matched: true,
          priority: 1,
          strategy: 'EXACT_PAYMENT_ID',
          payment,
          walletTransaction: null,
          ledgerEntries,
          classification: ledgerEntries.length > 0
            ? RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL
            : RECONCILIATION_CLASSIFICATIONS.MATCHED,
          reason: 'Matched via exact paymentId',
        };
      }
    }

    // --- Priority 2: Exact gatewayTransactionId / gatewayOrderId ---
    const gatewayTxnId = source.razorpayTransactionId || source.razorpay_payment_id || source.paymentLinkId;
    const gatewayOrderId = source.razorpay_order_id;

    if (gatewayTxnId || gatewayOrderId) {
      const query = { orgId, isDeleted: false };
      const orClauses = [];
      if (gatewayTxnId) orClauses.push({ gatewayTransactionId: gatewayTxnId });
      if (gatewayOrderId) orClauses.push({ gatewayOrderId });

      if (orClauses.length > 0) {
        query.$or = orClauses;
        const payment = await Payment.findOne(query).lean();
        if (payment) {
          const ledgerEntries = await this.findLedgerEntries(domainType, sourceId, payment._id);
          return {
            matched: true,
            priority: 2,
            strategy: 'GATEWAY_IDENTIFIER',
            payment,
            walletTransaction: null,
            ledgerEntries,
            classification: ledgerEntries.length > 0
              ? RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL
              : RECONCILIATION_CLASSIFICATIONS.MATCHED,
            reason: 'Matched via gateway transaction/order identifier',
          };
        }
      }
    }

    // --- Priority 3: Explicit domain reference ---
    const explicitPayments = await Payment.find({
      orgId,
      referenceType: domainType,
      referenceId: sourceId,
      isDeleted: false,
    }).lean();

    if (explicitPayments.length === 1) {
      const payment = explicitPayments[0];
      const ledgerEntries = await this.findLedgerEntries(domainType, sourceId, payment._id);
      return {
        matched: true,
        priority: 3,
        strategy: 'EXPLICIT_DOMAIN_REFERENCE',
        payment,
        walletTransaction: null,
        ledgerEntries,
        classification: ledgerEntries.length > 0
          ? RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL
          : RECONCILIATION_CLASSIFICATIONS.MATCHED,
        reason: 'Matched via explicit domain reference (referenceType & referenceId)',
      };
    } else if (explicitPayments.length > 1) {
      return {
        matched: false,
        priority: 3,
        strategy: 'EXPLICIT_DOMAIN_REFERENCE',
        payment: null,
        walletTransaction: null,
        ledgerEntries: [],
        classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
        reason: `Multiple (${explicitPayments.length}) Payment records found referencing source ${sourceId}`,
      };
    }

    // --- Priority 4: Explicit WalletTransaction reference ---
    const walletTxnQuery = {
      orgId,
      $or: [
        { referenceId: sourceId },
        { bookingId: source.bookingId || 'NONE' },
      ],
    };
    const walletTxns = await WalletTransaction.find(walletTxnQuery).lean();

    if (walletTxns.length === 1) {
      const txn = walletTxns[0];
      const ledgerEntries = await this.findLedgerEntries(domainType, sourceId, null);
      return {
        matched: true,
        priority: 4,
        strategy: 'WALLET_TRANSACTION_REFERENCE',
        payment: null,
        walletTransaction: txn,
        ledgerEntries,
        classification: ledgerEntries.length > 0
          ? RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL
          : RECONCILIATION_CLASSIFICATIONS.BACKFILL_REQUIRED,
        reason: 'Matched via explicit WalletTransaction reference',
      };
    } else if (walletTxns.length > 1) {
      return {
        matched: false,
        priority: 4,
        strategy: 'WALLET_TRANSACTION_REFERENCE',
        payment: null,
        walletTransaction: null,
        ledgerEntries: [],
        classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
        reason: `Multiple (${walletTxns.length}) WalletTransactions found referencing source ${sourceId}`,
      };
    }

    // --- Priority 5: Conservative composite matching ---
    if (userId && amount > 0) {
      // Search for unmatched payments with same orgId, userId, amount
      const candidatePayments = await Payment.find({
        orgId,
        userId,
        amount,
        status: { $in: ['success', 'PAID'] },
        isDeleted: false,
        referenceId: { $ne: sourceId }, // hasn't already been explicitly linked to this source
      }).lean();

      if (candidatePayments.length === 1) {
        const candidate = candidatePayments[0];
        // Ensure candidate isn't actively claimed by another entity
        const isClaimed = candidate.referenceId && candidate.referenceType;
        if (!isClaimed || candidate.referenceId.toString() === sourceId.toString()) {
          const ledgerEntries = await this.findLedgerEntries(domainType, sourceId, candidate._id);
          return {
            matched: true,
            priority: 5,
            strategy: 'COMPOSITE_CONSERVATIVE',
            payment: candidate,
            walletTransaction: null,
            ledgerEntries,
            classification: ledgerEntries.length > 0
              ? RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL
              : RECONCILIATION_CLASSIFICATIONS.MATCHED,
            reason: 'Matched via conservative composite match (orgId, userId, amount)',
          };
        }
      } else if (candidatePayments.length > 1) {
        return {
          matched: false,
          priority: 5,
          strategy: 'COMPOSITE_CONSERVATIVE',
          payment: null,
          walletTransaction: null,
          ledgerEntries: [],
          classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
          reason: `Ambiguous: Multiple (${candidatePayments.length}) candidate payments matched composite criteria`,
        };
      }
    }

    // Fallback: Check if ledger entries exist directly for this reference
    const directLedgerEntries = await this.findLedgerEntries(domainType, sourceId, null);
    if (directLedgerEntries.length > 0) {
      return {
        matched: true,
        priority: 0,
        strategy: 'DIRECT_LEDGER_REFERENCE',
        payment: null,
        walletTransaction: null,
        ledgerEntries: directLedgerEntries,
        classification: RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL,
        reason: 'Direct financial ledger entries already exist for source',
      };
    }

    // --- Not Matched ---
    return {
      matched: false,
      priority: null,
      strategy: 'NONE',
      payment: null,
      walletTransaction: null,
      ledgerEntries: [],
      classification: RECONCILIATION_CLASSIFICATIONS.UNMATCHED,
      reason: 'No authoritative payment, wallet transaction, or ledger entry found',
    };
  }

  /**
   * Helper to query ledger entries for a source
   */
  async findLedgerEntries(referenceType, referenceId, paymentId = null) {
    const query = {
      $or: [
        { referenceType, referenceId },
      ],
    };
    if (paymentId) {
      query.$or.push({ paymentId });
    }
    return await FinancialLedgerEntry.find(query).lean();
  }
}

export const historicalMatcherService = new HistoricalMatcherService();
export default historicalMatcherService;
