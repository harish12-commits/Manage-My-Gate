import mongoose from 'mongoose';
import financialLedgerRepository from './financialLedger.repository.js';
import {
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
  resolveDoubleEntryAccounts,
} from './financialLedger.constants.js';
import {
  financialLedgerEventEmitter,
  LEDGER_TRANSACTION_CREATED,
  LEDGER_TRANSACTION_DUPLICATE,
  LEDGER_TRANSACTION_FAILED,
} from './financialLedger.events.js';
import logger from '../../utils/logger.utils.js';
import HttpError from '../../utils/httpError.utils.js';

export class FinancialLedgerService {
  /**
   * Record a double-entry ledger entry for a settled payment.
   * Runs within the caller's transaction session.
   * @param {object} payment
   * @param {string} domain - INVOICE | AMENITY | WALLET
   * @param {import('mongoose').ClientSession} [session]
   */
  async recordSettlementLedgerEntry(payment, domain, session = null) {
    const paymentId = payment._id;
    const orgId = payment.orgId;
    const amount = Number(payment.amount);
    const paymentMethod = payment.paymentMethod || 'ONLINE';

    // 1. Tenant validation
    if (!orgId) {
      throw new HttpError(400, 'Cannot record ledger entry: Organization (tenant) ID is required.');
    }
    if (!amount || amount <= 0) {
      throw new HttpError(400, `Cannot record ledger entry: Invalid amount ${amount}.`);
    }

    // 2. Resolve double-entry debit and credit accounts
    const { debitAccount, creditAccount } = resolveDoubleEntryAccounts(domain, paymentMethod, false);

    // 3. Deterministic transaction identity & idempotency key
    const idempotencyKey = `${paymentId.toString()}:SETTLEMENT`;
    const transactionId = `FTX-SET-${paymentId.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const ledgerPayload = {
      transactionId,
      orgId,
      userId: payment.userId || null,
      paymentId,
      domain,
      referenceType: payment.referenceType || domain,
      referenceId: payment.referenceId || paymentId,
      debitAccount,
      creditAccount,
      amount,
      currency: payment.currency || 'INR',
      status: LEDGER_STATUSES.POSTED,
      idempotencyKey,
      description: `Settlement of ${domain} payment (Method: ${paymentMethod}, Ref: ${payment.gatewayTransactionId || paymentId})`,
      metadata: {
        paymentMethod,
        gatewayTransactionId: payment.gatewayTransactionId,
        gatewayOrderId: payment.gatewayOrderId,
        settledAt: new Date(),
      },
      entries: [
        {
          account: debitAccount,
          entryType: ENTRY_TYPES.DEBIT,
          amount,
        },
        {
          account: creditAccount,
          entryType: ENTRY_TYPES.CREDIT,
          amount,
        },
      ],
    };

    try {
      const { entry, alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);

      if (alreadyExists) {
        logger.info('financialLedger.entry_already_exists', { paymentId, idempotencyKey });
        financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_DUPLICATE, entry);
      } else {
        logger.info('financialLedger.entry_created', {
          transactionId: entry.transactionId,
          paymentId,
          domain,
          amount,
          debitAccount,
          creditAccount,
        });
        financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_CREATED, entry);
      }

      return entry;
    } catch (err) {
      logger.error('financialLedger.entry_failed', { paymentId, error: err.message });
      financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_FAILED, { paymentId, error: err.message });
      throw err;
    }
  }

  /**
   * Record a compensating double-entry ledger entry for a payment refund.
   * Runs within the caller's transaction session.
   */
  async recordRefundLedgerEntry(originalPayment, refundRecord, domain, session = null) {
    const originalPaymentId = originalPayment._id;
    const refundId = refundRecord._id;
    const orgId = originalPayment.orgId;
    const amount = Math.abs(Number(refundRecord.amount));
    const paymentMethod = originalPayment.paymentMethod || 'ONLINE';

    if (!orgId) {
      throw new HttpError(400, 'Cannot record refund ledger entry: Organization ID is required.');
    }
    if (!amount || amount <= 0) {
      throw new HttpError(400, `Cannot record refund ledger entry: Invalid amount ${amount}.`);
    }

    // Double-entry for refund: Debit Revenue Adjustment, Credit Clearing/Wallet
    const { debitAccount, creditAccount } = resolveDoubleEntryAccounts(domain, paymentMethod, true);

    const idempotencyKey = `${refundId.toString()}:REFUND`;
    const transactionId = `FTX-REF-${refundId.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const ledgerPayload = {
      transactionId,
      orgId,
      userId: originalPayment.userId || null,
      paymentId: originalPaymentId,
      domain: 'REFUND',
      referenceType: 'Refund',
      referenceId: refundId,
      debitAccount,
      creditAccount,
      amount,
      currency: originalPayment.currency || 'INR',
      status: LEDGER_STATUSES.POSTED,
      idempotencyKey,
      description: `Refund adjustment for ${domain} (Original Payment: ${originalPayment.gatewayTransactionId || originalPaymentId})`,
      metadata: {
        originalPaymentId,
        refundId,
        paymentMethod,
        reason: refundRecord.reason || 'User or admin initiated refund',
      },
      entries: [
        {
          account: debitAccount,
          entryType: ENTRY_TYPES.DEBIT,
          amount,
        },
        {
          account: creditAccount,
          entryType: ENTRY_TYPES.CREDIT,
          amount,
        },
      ],
    };

    const { entry, alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);

    if (alreadyExists) {
      financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_DUPLICATE, entry);
    } else {
      financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_CREATED, entry);
    }

    return entry;
  }

  /**
   * Record a double-entry ledger entry for a direct wallet debit (e.g. resident pays invoice or booking using wallet).
   */
  async recordWalletDebitEntry({
    userId,
    orgId,
    amount,
    referenceType = 'Other',
    referenceId,
    paymentId = null,
    idempotencyKey = null,
    description = '',
    session = null,
  }) {
    const numericAmount = Number(amount);
    if (!orgId || !numericAmount || numericAmount <= 0) {
      throw new HttpError(400, 'Invalid parameters for wallet debit ledger entry.');
    }

    let creditAccount = FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE;
    let domain = 'INVOICE';
    if (referenceType === 'AmenityBooking') {
      creditAccount = FINANCIAL_ACCOUNTS.AMENITY_REVENUE;
      domain = 'AMENITY';
    } else if (referenceType === 'Refund') {
      creditAccount = FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING;
      domain = 'REFUND';
    }

    const key = idempotencyKey || `${userId.toString()}:${referenceId ? referenceId.toString() : 'NONE'}:WALLET_DEBIT:${numericAmount}`;
    const transactionId = `FTX-WDR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const ledgerPayload = {
      transactionId,
      orgId,
      userId,
      paymentId: paymentId || null,
      domain,
      referenceType,
      referenceId: referenceId || new mongoose.Types.ObjectId(),
      debitAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
      creditAccount,
      amount: numericAmount,
      currency: 'INR',
      status: LEDGER_STATUSES.POSTED,
      idempotencyKey: key,
      description: description || `Wallet debit of ₹${numericAmount} for ${referenceType}`,
      entries: [
        {
          account: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
          entryType: ENTRY_TYPES.DEBIT,
          amount: numericAmount,
        },
        {
          account: creditAccount,
          entryType: ENTRY_TYPES.CREDIT,
          amount: numericAmount,
        },
      ],
    };

    const { entry } = await financialLedgerRepository.createEntry(ledgerPayload, session);
    financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_CREATED, entry);
    return entry;
  }

  /**
   * Record a double-entry ledger entry for a wallet credit (recharge or refund credit).
   */
  async recordWalletCreditEntry({
    userId,
    orgId,
    amount,
    referenceType = 'Recharge',
    referenceId,
    paymentId = null,
    idempotencyKey = null,
    paymentMethod = 'ONLINE',
    description = '',
    session = null,
  }) {
    const numericAmount = Number(amount);
    if (!orgId || !numericAmount || numericAmount <= 0) {
      throw new HttpError(400, 'Invalid parameters for wallet credit ledger entry.');
    }

    let debitAccount = FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING;
    if (paymentMethod === 'CASH') debitAccount = FINANCIAL_ACCOUNTS.CASH_CLEARING;
    else if (paymentMethod === 'BANK_TRANSFER') debitAccount = FINANCIAL_ACCOUNTS.BANK_CLEARING;

    if (referenceType === 'Refund' || referenceType === 'AmenityBooking') {
      debitAccount = FINANCIAL_ACCOUNTS.REVENUE_ADJUSTMENT;
    }

    const key = idempotencyKey || `${userId.toString()}:${referenceId ? referenceId.toString() : 'NONE'}:WALLET_CREDIT:${numericAmount}`;
    const transactionId = `FTX-WCR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const ledgerPayload = {
      transactionId,
      orgId,
      userId,
      paymentId: paymentId || null,
      domain: referenceType === 'Refund' ? 'REFUND' : 'WALLET',
      referenceType,
      referenceId: referenceId || new mongoose.Types.ObjectId(),
      debitAccount,
      creditAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
      amount: numericAmount,
      currency: 'INR',
      status: LEDGER_STATUSES.POSTED,
      idempotencyKey: key,
      description: description || `Wallet credit of ₹${numericAmount} via ${paymentMethod}`,
      entries: [
        {
          account: debitAccount,
          entryType: ENTRY_TYPES.DEBIT,
          amount: numericAmount,
        },
        {
          account: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
          entryType: ENTRY_TYPES.CREDIT,
          amount: numericAmount,
        },
      ],
    };

    const { entry } = await financialLedgerRepository.createEntry(ledgerPayload, session);
    financialLedgerEventEmitter.emit(LEDGER_TRANSACTION_CREATED, entry);
    return entry;
  }

  // ==========================================================================
  // Read APIs (Section 25)
  // ==========================================================================

  async getTransaction(transactionId) {
    if (!transactionId) throw new HttpError(400, 'Transaction ID is required');
    const entry = await financialLedgerRepository.findByTransactionId(transactionId);
    if (!entry) throw new HttpError(404, `Ledger transaction ${transactionId} not found`);
    return entry;
  }

  async getPaymentLedger(paymentId) {
    if (!paymentId) throw new HttpError(400, 'Payment ID is required');
    return await financialLedgerRepository.findByPaymentId(paymentId);
  }

  async getWalletLedger(walletId) {
    if (!walletId) throw new HttpError(400, 'Wallet ID is required');
    const Wallet = (await import('../wallet/wallet.model.js')).Wallet;
    const wallet = await Wallet.findById(walletId);
    if (!wallet) throw new HttpError(404, 'Wallet not found');

    return await financialLedgerRepository.getFinancialHistory(
      wallet.orgId,
      { userId: wallet.userId },
      { limit: 50 }
    );
  }

  async getDomainLedger(referenceType, referenceId) {
    if (!referenceType || !referenceId) throw new HttpError(400, 'referenceType and referenceId are required');
    return await financialLedgerRepository.findByReference(referenceType, referenceId);
  }

  async getFinancialHistory(orgId, filters = {}, options = {}) {
    if (!orgId) throw new HttpError(400, 'Organization (tenant) ID is required');
    return await financialLedgerRepository.getFinancialHistory(orgId, filters, options);
  }

  async getAccountBalances(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization (tenant) ID is required');
    return await financialLedgerRepository.getAccountBalances(orgId);
  }

  // ==========================================================================
  // Diagnostic Consistency & Reconciliation Checks (Section 27)
  // ==========================================================================

  /**
   * Non-destructive consistency auditor identifying accounting discrepancies:
   * 1. Successful payments missing a ledger entry
   * 2. Wallet transactions missing a ledger entry
   * 3. Wallet balances diverging from sum of transaction credits and debits
   * @param {string|mongoose.Types.ObjectId} orgId
   * @returns {Promise<object>} Diagnostic report
   */
  async checkReconciliation(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required for reconciliation check');

    const Payment = (await import('../payment/payment.model.js')).default;
    const { Wallet, WalletTransaction } = await import('../wallet/wallet.model.js');

    const diagnostics = {
      orgId: orgId.toString(),
      timestamp: new Date(),
      paymentsWithoutLedger: [],
      walletTransactionsWithoutLedger: [],
      divergentWalletBalances: [],
      isClean: true,
    };

    // 1. Audit successful payments without a ledger record
    const successfulPayments = await Payment.find({
      orgId,
      status: 'success',
      isDeleted: false,
    }).lean();

    for (const p of successfulPayments) {
      let ledger = await financialLedgerRepository.findByPaymentId(p._id);
      if ((!ledger || ledger.length === 0) && (p.type === 'Refund' || p.amount < 0)) {
        ledger = await financialLedgerRepository.findByReference('Refund', p._id);
      }
      if (!ledger || ledger.length === 0) {
        diagnostics.paymentsWithoutLedger.push({
          paymentId: p._id.toString(),
          amount: p.amount,
          domain: p.domain,
          referenceId: p.referenceId?.toString(),
          date: p.paymentDate || p.createdAt,
        });
      }
    }

    // 2. Audit wallet transactions without a ledger record
    const walletTxns = await WalletTransaction.find({
      orgId,
      paymentStatus: 'success',
    }).lean();

    for (const txn of walletTxns) {
      const ledger = await financialLedgerRepository.findByReference(txn.referenceType || 'Other', txn.referenceId || txn._id);
      if (!ledger || ledger.length === 0) {
        diagnostics.walletTransactionsWithoutLedger.push({
          transactionId: txn.transactionId,
          type: txn.type,
          amount: txn.amount,
          referenceType: txn.referenceType,
        });
      }
    }

    // 3. Audit wallet balances vs transaction math
    const wallets = await Wallet.find({ orgId }).lean();
    for (const w of wallets) {
      const userTxns = await WalletTransaction.find({
        orgId,
        userId: w.userId,
        paymentStatus: 'success',
      }).lean();

      const calculatedBalance = userTxns.reduce((sum, t) => {
        if (t.type === 'Credit') return sum + Number(t.amount || 0);
        if (t.type === 'Debit') return sum - Number(t.amount || 0);
        return sum;
      }, 0);

      const roundedCalculated = Math.round(calculatedBalance * 100) / 100;
      const roundedStored = Math.round(Number(w.balance || 0) * 100) / 100;

      if (Math.abs(roundedCalculated - roundedStored) > 0.01) {
        diagnostics.divergentWalletBalances.push({
          walletId: w._id.toString(),
          userId: w.userId.toString(),
          storedBalance: roundedStored,
          calculatedBalance: roundedCalculated,
          difference: Math.round((roundedStored - roundedCalculated) * 100) / 100,
        });
      }
    }

    diagnostics.isClean =
      diagnostics.paymentsWithoutLedger.length === 0 &&
      diagnostics.walletTransactionsWithoutLedger.length === 0 &&
      diagnostics.divergentWalletBalances.length === 0;

    return diagnostics;
  }
}

export const financialLedgerService = new FinancialLedgerService();
export default financialLedgerService;
