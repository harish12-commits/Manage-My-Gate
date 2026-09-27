import mongoose from 'mongoose';
import Organization from '../../organization/organization.model.js';
import Invoice from '../../invoice/invoice.model.js';
import AmenityBooking from '../../amenityBooking/amenityBooking.model.js';
import { Wallet, WalletTransaction } from '../../wallet/wallet.model.js';
import Payment from '../../payment/payment.model.js';
import paymentService from '../../payment/payment.service.js';
import financialLedgerRepository from '../financialLedger.repository.js';
import {
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
  resolveDoubleEntryAccounts,
} from '../financialLedger.constants.js';
import {
  RECONCILIATION_CLASSIFICATIONS,
  RECONCILIATION_EXCEPTION_STATUSES,
  MIGRATION_EXECUTION_MODES,
  RECONCILIATION_DOMAINS,
  RECONCILIATION_SOURCE_TYPES,
} from './reconciliation.constants.js';
import HistoricalMigrationRun from './models/historicalMigrationRun.model.js';
import ReconciliationException from './models/reconciliationException.model.js';
import historicalInventoryService from './historicalInventory.service.js';
import historicalMatcherService from './historicalMatcher.service.js';
import reconciliationReportService from './reconciliationReport.service.js';
import logger from '../../../utils/logger.utils.js';
import HttpError from '../../../utils/httpError.utils.js';

export class HistoricalReconciliationService {
  /**
   * Run historical reconciliation in DRY_RUN, EXECUTE, or VERIFY mode.
   *
   * @param {object} params
   * @param {string|mongoose.Types.ObjectId|null} [params.orgId] - Target tenant (null for all tenants)
   * @param {string} [params.mode] - 'DRY_RUN' | 'EXECUTE' | 'VERIFY'
   * @param {boolean} [params.allowGenesis] - Whether to allow authoritative opening genesis balances
   * @param {string[]} [params.domains] - Domains to reconcile: ['INVOICE', 'AMENITY', 'WALLET']
   * @returns {Promise<object>} Reconciliation run result
   */
  async reconcile({
    orgId = null,
    mode = MIGRATION_EXECUTION_MODES.DRY_RUN,
    allowGenesis = false,
    domains = [RECONCILIATION_DOMAINS.INVOICE, RECONCILIATION_DOMAINS.AMENITY, RECONCILIATION_DOMAINS.WALLET],
  } = {}) {
    const normMode = (mode || MIGRATION_EXECUTION_MODES.DRY_RUN).toUpperCase();

    // 1. Fast-path: VERIFY mode (read-only invariant audit)
    if (normMode === MIGRATION_EXECUTION_MODES.VERIFY) {
      const verification = await reconciliationReportService.verifyFinancialInvariants(orgId);
      return {
        runId: `VERIFY-${Date.now().toString(36).toUpperCase()}`,
        mode: MIGRATION_EXECUTION_MODES.VERIFY,
        status: verification.invariantsPassed ? 'PASSED' : 'FAILED',
        verification,
      };
    }

    const runId = `RUN-REC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const isDryRun = normMode === MIGRATION_EXECUTION_MODES.DRY_RUN;

    // 2. Fetch inventory snapshot
    const inventorySnapshot = await historicalInventoryService.getInventory(orgId);

    // 3. Resolve target organizations
    const orgFilter = orgId ? { _id: new mongoose.Types.ObjectId(orgId) } : {};
    const orgs = await Organization.find(orgFilter).select('_id name code').lean();

    const summary = {
      totalProcessed: 0,
      alreadyCanonical: 0,
      matched: 0,
      backfillRequired: 0,
      backfilledPayments: 0,
      backfilledLedgerEntries: 0,
      genesisEntries: 0,
      exceptionsCount: 0,
      unmatchedCount: 0,
      conflictCount: 0,
      invalidCount: 0,
      excludedCount: 0,
      totalAmountReconciled: 0,
    };

    const inMemoryExceptions = [];
    const executionDetails = {
      tenantsProcessed: orgs.length,
      tenantDetails: [],
    };

    let session = null;
    if (!isDryRun) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      for (const org of orgs) {
        const tenantOrgId = org._id;
        const tenantDetail = {
          orgId: tenantOrgId.toString(),
          name: org.name,
          invoicesProcessed: 0,
          amenitiesProcessed: 0,
          walletsProcessed: 0,
          exceptions: 0,
        };

        // ====================================================================
        // Domain A: INVOICES
        // ====================================================================
        if (domains.includes(RECONCILIATION_DOMAINS.INVOICE)) {
          const invoices = await Invoice.find({ orgId: tenantOrgId, isDeleted: false })
            .session(session || undefined)
            .lean();

          for (const inv of invoices) {
            summary.totalProcessed++;
            tenantDetail.invoicesProcessed++;

            const paidAmt = Number(inv.paidAmount || 0);

            // Validation check
            if (!inv.orgId) {
              summary.invalidCount++;
              summary.exceptionsCount++;
              await this._recordException(
                {
                  orgId: tenantOrgId,
                  sourceType: RECONCILIATION_SOURCE_TYPES.INVOICE,
                  sourceId: inv._id,
                  domain: RECONCILIATION_DOMAINS.INVOICE,
                  classification: RECONCILIATION_CLASSIFICATIONS.INVALID,
                  reason: 'Invoice is missing organization reference (orgId)',
                  discrepancyDetails: { expectedAmount: inv.totalAmount || 0, actualAmount: 0, variance: inv.totalAmount || 0 },
                  runId,
                },
                isDryRun,
                inMemoryExceptions,
                session
              );
              continue;
            }

            // Excluded check: completely unpaid invoice
            if ((inv.status === 'UNPAID' || !inv.status) && paidAmt === 0) {
              summary.excludedCount++;
              continue;
            }

            // Reconcile paid or partially paid invoice
            if (inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID' || paidAmt > 0) {
              const match = await historicalMatcherService.matchRecord(inv, 'Invoice');

              if (match.classification === RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL) {
                summary.alreadyCanonical++;
              } else if (match.classification === RECONCILIATION_CLASSIFICATIONS.MATCHED && match.payment) {
                // Matched existing Payment, but FinancialLedgerEntry is missing
                summary.matched++;
                summary.backfillRequired++;

                if (!isDryRun) {
                  const payment = match.payment;
                  const paymentMethod = payment.paymentMethod || inv.paymentMethod || 'ONLINE';
                  const { debitAccount, creditAccount } = resolveDoubleEntryAccounts('INVOICE', paymentMethod, false);

                  const ledgerPayload = {
                    transactionId: `FTX-HIST-PAY-${payment._id.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
                    orgId: tenantOrgId,
                    userId: payment.userId || inv.targetUserId,
                    paymentId: payment._id,
                    domain: 'INVOICE',
                    referenceType: 'Invoice',
                    referenceId: inv._id,
                    debitAccount,
                    creditAccount,
                    amount: payment.amount,
                    currency: payment.currency || 'INR',
                    status: LEDGER_STATUSES.POSTED,
                    idempotencyKey: `HISTORICAL:Payment:${payment._id}:LEDGER`,
                    description: `Historical backfill ledger entry for invoice ${inv.invoiceNumber || inv._id}`,
                    metadata: { isHistoricalBackfill: true, originalSource: 'Payment', runId },
                    entries: [
                      { account: debitAccount, entryType: ENTRY_TYPES.DEBIT, amount: payment.amount },
                      { account: creditAccount, entryType: ENTRY_TYPES.CREDIT, amount: payment.amount },
                    ],
                  };

                  const { alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);
                  if (!alreadyExists) {
                    summary.backfilledLedgerEntries++;
                    summary.totalAmountReconciled += payment.amount;
                  } else {
                    summary.alreadyCanonical++;
                  }
                } else {
                  summary.backfilledLedgerEntries++;
                  summary.totalAmountReconciled += match.payment.amount;
                }
              } else if (
                match.classification === RECONCILIATION_CLASSIFICATIONS.BACKFILL_REQUIRED ||
                match.walletTransaction
              ) {
                // Authoritative transaction evidence found
                summary.backfillRequired++;

                if (!isDryRun) {
                  // 1. Create canonical Payment
                  const paymentMethod = inv.paymentMethod || (match.walletTransaction ? 'WALLET' : 'ONLINE');
                  const paymentData = {
                    orgId: tenantOrgId,
                    userId: inv.targetUserId,
                    referenceId: inv._id,
                    referenceType: 'Invoice',
                    amount: paidAmt,
                    currency: inv.currency || 'INR',
                    status: 'success',
                    paymentCategory: paymentMethod === 'CASH' ? 'OFFLINE' : 'ONLINE',
                    paymentMethod,
                    domain: 'INVOICE',
                    idempotencyKey: `HISTORICAL:Invoice:${inv._id}:0`,
                    metadata: { isHistoricalBackfill: true, originalSource: 'Invoice', runId },
                  };

                  let paymentDoc = await Payment.findOne({ idempotencyKey: paymentData.idempotencyKey }).session(session);
                  if (!paymentDoc) {
                    paymentDoc = await paymentService.recordPayment(paymentData, session);
                    summary.backfilledPayments++;
                  }

                  // 2. Create FinancialLedgerEntry
                  const { debitAccount, creditAccount } = resolveDoubleEntryAccounts('INVOICE', paymentMethod, false);
                  const ledgerPayload = {
                    transactionId: `FTX-HIST-INV-${inv._id.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
                    orgId: tenantOrgId,
                    userId: inv.targetUserId,
                    paymentId: paymentDoc._id,
                    domain: 'INVOICE',
                    referenceType: 'Invoice',
                    referenceId: inv._id,
                    debitAccount,
                    creditAccount,
                    amount: paidAmt,
                    currency: inv.currency || 'INR',
                    status: LEDGER_STATUSES.POSTED,
                    idempotencyKey: `HISTORICAL:Invoice:${inv._id}:LEDGER`,
                    description: `Historical backfill ledger entry for invoice ${inv.invoiceNumber || inv._id}`,
                    metadata: { isHistoricalBackfill: true, originalSource: 'Invoice', runId },
                    entries: [
                      { account: debitAccount, entryType: ENTRY_TYPES.DEBIT, amount: paidAmt },
                      { account: creditAccount, entryType: ENTRY_TYPES.CREDIT, amount: paidAmt },
                    ],
                  };

                  const { alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);
                  if (!alreadyExists) {
                    summary.backfilledLedgerEntries++;
                    summary.totalAmountReconciled += paidAmt;
                  }
                } else {
                  summary.backfilledPayments++;
                  summary.backfilledLedgerEntries++;
                  summary.totalAmountReconciled += paidAmt;
                }
              } else {
                // UNMATCHED or CONFLICT: Invoice marked PAID or partial, but zero payment or transaction proof exists
                summary.exceptionsCount++;
                if (match.classification === RECONCILIATION_CLASSIFICATIONS.CONFLICT) summary.conflictCount++;
                else summary.unmatchedCount++;
                tenantDetail.exceptions++;

                await this._recordException(
                  {
                    orgId: tenantOrgId,
                    sourceType: RECONCILIATION_SOURCE_TYPES.INVOICE,
                    sourceId: inv._id,
                    domain: RECONCILIATION_DOMAINS.INVOICE,
                    classification: match.classification,
                    reason: match.reason || 'Invoice marked as paid but no underlying payment or transaction record found',
                    discrepancyDetails: {
                      expectedAmount: paidAmt,
                      actualAmount: 0,
                      variance: paidAmt,
                      details: { invoiceNumber: inv.invoiceNumber, status: inv.status },
                    },
                    runId,
                  },
                  isDryRun,
                  inMemoryExceptions,
                  session
                );
              }
            }
          }
        }

        // ====================================================================
        // Domain B: AMENITY BOOKINGS
        // ====================================================================
        if (domains.includes(RECONCILIATION_DOMAINS.AMENITY)) {
          const bookings = await AmenityBooking.find({ orgId: tenantOrgId })
            .session(session || undefined)
            .lean();

          for (const booking of bookings) {
            summary.totalProcessed++;
            tenantDetail.amenitiesProcessed++;

            const bookingAmt = Number(booking.pricingDetails?.totalAmount || booking.totalAmount || 0);
            const pStatus = booking.paymentStatus || 'pending';

            if (pStatus === 'pending' && bookingAmt === 0) {
              summary.excludedCount++;
              continue;
            }

            if (pStatus === 'captured' || pStatus === 'success' || bookingAmt > 0) {
              const match = await historicalMatcherService.matchRecord(booking, 'AmenityBooking');

              if (match.classification === RECONCILIATION_CLASSIFICATIONS.ALREADY_CANONICAL) {
                summary.alreadyCanonical++;
              } else if (match.classification === RECONCILIATION_CLASSIFICATIONS.MATCHED && match.payment) {
                summary.matched++;
                summary.backfillRequired++;

                if (!isDryRun) {
                  const payment = match.payment;
                  const paymentMethod = payment.paymentMethod || booking.paymentMethod || 'ONLINE';
                  const { debitAccount, creditAccount } = resolveDoubleEntryAccounts('AMENITY', paymentMethod, false);

                  const ledgerPayload = {
                    transactionId: `FTX-HIST-AMN-${payment._id.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
                    orgId: tenantOrgId,
                    userId: payment.userId || booking.userId,
                    paymentId: payment._id,
                    domain: 'AMENITY',
                    referenceType: 'AmenityBooking',
                    referenceId: booking._id,
                    debitAccount,
                    creditAccount,
                    amount: payment.amount,
                    currency: payment.currency || 'INR',
                    status: LEDGER_STATUSES.POSTED,
                    idempotencyKey: `HISTORICAL:Payment:${payment._id}:LEDGER`,
                    description: `Historical backfill ledger entry for booking ${booking.bookingId || booking._id}`,
                    metadata: { isHistoricalBackfill: true, originalSource: 'Payment', runId },
                    entries: [
                      { account: debitAccount, entryType: ENTRY_TYPES.DEBIT, amount: payment.amount },
                      { account: creditAccount, entryType: ENTRY_TYPES.CREDIT, amount: payment.amount },
                    ],
                  };

                  const { alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);
                  if (!alreadyExists) {
                    summary.backfilledLedgerEntries++;
                    summary.totalAmountReconciled += payment.amount;
                  } else {
                    summary.alreadyCanonical++;
                  }
                } else {
                  summary.backfilledLedgerEntries++;
                  summary.totalAmountReconciled += match.payment.amount;
                }
              } else if (
                match.classification === RECONCILIATION_CLASSIFICATIONS.BACKFILL_REQUIRED ||
                match.walletTransaction
              ) {
                summary.backfillRequired++;

                if (!isDryRun) {
                  const paymentMethod = booking.paymentMethod || (match.walletTransaction ? 'WALLET' : 'ONLINE');
                  const paymentData = {
                    orgId: tenantOrgId,
                    userId: booking.userId,
                    referenceId: booking._id,
                    referenceType: 'AmenityBooking',
                    amount: bookingAmt,
                    currency: 'INR',
                    status: 'success',
                    paymentCategory: paymentMethod === 'CASH' ? 'OFFLINE' : 'ONLINE',
                    paymentMethod,
                    domain: 'AMENITY',
                    idempotencyKey: `HISTORICAL:AmenityBooking:${booking._id}:0`,
                    metadata: { isHistoricalBackfill: true, originalSource: 'AmenityBooking', runId },
                  };

                  let paymentDoc = await Payment.findOne({ idempotencyKey: paymentData.idempotencyKey }).session(session);
                  if (!paymentDoc) {
                    paymentDoc = await paymentService.recordPayment(paymentData, session);
                    summary.backfilledPayments++;
                  }

                  const { debitAccount, creditAccount } = resolveDoubleEntryAccounts('AMENITY', paymentMethod, false);
                  const ledgerPayload = {
                    transactionId: `FTX-HIST-AMN-${booking._id.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
                    orgId: tenantOrgId,
                    userId: booking.userId,
                    paymentId: paymentDoc._id,
                    domain: 'AMENITY',
                    referenceType: 'AmenityBooking',
                    referenceId: booking._id,
                    debitAccount,
                    creditAccount,
                    amount: bookingAmt,
                    currency: 'INR',
                    status: LEDGER_STATUSES.POSTED,
                    idempotencyKey: `HISTORICAL:AmenityBooking:${booking._id}:LEDGER`,
                    description: `Historical backfill ledger entry for booking ${booking.bookingId || booking._id}`,
                    metadata: { isHistoricalBackfill: true, originalSource: 'AmenityBooking', runId },
                    entries: [
                      { account: debitAccount, entryType: ENTRY_TYPES.DEBIT, amount: bookingAmt },
                      { account: creditAccount, entryType: ENTRY_TYPES.CREDIT, amount: bookingAmt },
                    ],
                  };

                  const { alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);
                  if (!alreadyExists) {
                    summary.backfilledLedgerEntries++;
                    summary.totalAmountReconciled += bookingAmt;
                  }
                } else {
                  summary.backfilledPayments++;
                  summary.backfilledLedgerEntries++;
                  summary.totalAmountReconciled += bookingAmt;
                }
              } else {
                summary.exceptionsCount++;
                if (match.classification === RECONCILIATION_CLASSIFICATIONS.CONFLICT) summary.conflictCount++;
                else summary.unmatchedCount++;
                tenantDetail.exceptions++;

                await this._recordException(
                  {
                    orgId: tenantOrgId,
                    sourceType: RECONCILIATION_SOURCE_TYPES.AMENITY_BOOKING,
                    sourceId: booking._id,
                    domain: RECONCILIATION_DOMAINS.AMENITY,
                    classification: match.classification,
                    reason: match.reason || 'Amenity booking settled but no underlying payment or transaction record found',
                    discrepancyDetails: {
                      expectedAmount: bookingAmt,
                      actualAmount: 0,
                      variance: bookingAmt,
                      details: { bookingId: booking.bookingId, paymentStatus: booking.paymentStatus },
                    },
                    runId,
                  },
                  isDryRun,
                  inMemoryExceptions,
                  session
                );
              }
            }
          }
        }

        // ====================================================================
        // Domain C: WALLET TRANSACTIONS & GENESIS OPENING BALANCES
        // ====================================================================
        if (domains.includes(RECONCILIATION_DOMAINS.WALLET)) {
          // 1. Reconcile existing WalletTransaction records
          const walletTxns = await WalletTransaction.find({ orgId: tenantOrgId })
            .session(session || undefined)
            .lean();

          for (const txn of walletTxns) {
            summary.totalProcessed++;
            const txnAmt = Number(txn.amount || 0);
            if (txnAmt <= 0) continue;

            const existingLedger = await financialLedgerRepository.findByIdempotencyKey(
              `HISTORICAL:WalletTransaction:${txn._id}:LEDGER`,
              session
            );

            if (existingLedger) {
              summary.alreadyCanonical++;
            } else {
              summary.backfillRequired++;

              if (!isDryRun) {
                let debitAccount = FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING;
                let creditAccount = FINANCIAL_ACCOUNTS.RESIDENT_WALLET;

                if (txn.type === 'Debit') {
                  debitAccount = FINANCIAL_ACCOUNTS.RESIDENT_WALLET;
                  creditAccount =
                    txn.referenceType === 'AmenityBooking'
                      ? FINANCIAL_ACCOUNTS.AMENITY_REVENUE
                      : FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE;
                }

                const ledgerPayload = {
                  transactionId: `FTX-HIST-WTX-${txn._id.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
                  orgId: tenantOrgId,
                  userId: txn.userId,
                  paymentId: null,
                  domain: 'WALLET',
                  referenceType: 'WalletTransaction',
                  referenceId: txn._id,
                  debitAccount,
                  creditAccount,
                  amount: txnAmt,
                  currency: 'INR',
                  status: LEDGER_STATUSES.POSTED,
                  idempotencyKey: `HISTORICAL:WalletTransaction:${txn._id}:LEDGER`,
                  description: `Historical backfill ledger entry for wallet transaction ${txn.transactionId || txn._id}`,
                  metadata: { isHistoricalBackfill: true, originalSource: 'WalletTransaction', runId },
                  entries: [
                    { account: debitAccount, entryType: ENTRY_TYPES.DEBIT, amount: txnAmt },
                    { account: creditAccount, entryType: ENTRY_TYPES.CREDIT, amount: txnAmt },
                  ],
                };

                const { alreadyExists } = await financialLedgerRepository.createEntry(ledgerPayload, session);
                if (!alreadyExists) {
                  summary.backfilledLedgerEntries++;
                  summary.totalAmountReconciled += txnAmt;
                }
              } else {
                summary.backfilledLedgerEntries++;
                summary.totalAmountReconciled += txnAmt;
              }
            }
          }

          // 2. Reconcile Wallets and Authoritative Genesis Opening Balances
          const wallets = await Wallet.find({ orgId: tenantOrgId })
            .session(session || undefined)
            .lean();

          for (const wallet of wallets) {
            summary.totalProcessed++;
            tenantDetail.walletsProcessed++;

            const balance = Number(wallet.balance || 0);

            // Compute transaction sum
            const userTxns = walletTxns.filter((t) => t.userId.toString() === wallet.userId.toString());
            const txnSum = userTxns.reduce((sum, t) => {
              if (t.type === 'Credit') return sum + Number(t.amount || 0);
              if (t.type === 'Debit') return sum - Number(t.amount || 0);
              return sum;
            }, 0);

            const roundedTxnSum = Math.round(txnSum * 100) / 100;
            const roundedBalance = Math.round(balance * 100) / 100;

            if (userTxns.length === 0 && roundedBalance > 0) {
              // Authoritative opening balance without transactions -> Genesis candidate
              if (allowGenesis) {
                const genesisKey = `HISTORICAL:GENESIS:${wallet._id}`;
                const existingGenesis = await financialLedgerRepository.findByIdempotencyKey(genesisKey, session);

                if (existingGenesis) {
                  summary.alreadyCanonical++;
                } else {
                  if (!isDryRun) {
                    const genesisPayload = {
                      transactionId: `FTX-GEN-${wallet._id.toString().substring(18, 24).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
                      orgId: tenantOrgId,
                      userId: wallet.userId,
                      paymentId: null,
                      domain: 'WALLET',
                      referenceType: 'Wallet',
                      referenceId: wallet._id,
                      debitAccount: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING,
                      creditAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
                      amount: roundedBalance,
                      currency: 'INR',
                      status: LEDGER_STATUSES.POSTED,
                      idempotencyKey: genesisKey,
                      description: 'Authoritative opening genesis balance for historical wallet',
                      metadata: { isGenesis: true, isHistoricalBackfill: true, runId },
                      entries: [
                        { account: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING, entryType: ENTRY_TYPES.DEBIT, amount: roundedBalance },
                        { account: FINANCIAL_ACCOUNTS.RESIDENT_WALLET, entryType: ENTRY_TYPES.CREDIT, amount: roundedBalance },
                      ],
                    };

                    const { alreadyExists } = await financialLedgerRepository.createEntry(genesisPayload, session);
                    if (!alreadyExists) {
                      summary.genesisEntries++;
                      summary.totalAmountReconciled += roundedBalance;
                    }
                  } else {
                    summary.genesisEntries++;
                    summary.totalAmountReconciled += roundedBalance;
                  }
                }
              } else {
                // Genesis not permitted -> flag as conflict exception
                summary.exceptionsCount++;
                summary.conflictCount++;
                tenantDetail.exceptions++;

                await this._recordException(
                  {
                    orgId: tenantOrgId,
                    sourceType: RECONCILIATION_SOURCE_TYPES.WALLET,
                    sourceId: wallet._id,
                    domain: RECONCILIATION_DOMAINS.WALLET,
                    classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
                    reason: 'Wallet has opening balance without transaction history; Genesis ledger entry not authorized',
                    discrepancyDetails: {
                      expectedAmount: roundedBalance,
                      actualAmount: 0,
                      variance: roundedBalance,
                      details: { walletId: wallet._id, userId: wallet.userId },
                    },
                    runId,
                  },
                  isDryRun,
                  inMemoryExceptions,
                  session
                );
              }
            } else if (userTxns.length > 0 && Math.abs(roundedTxnSum - roundedBalance) > 0.01) {
              // Transactions exist, but math diverges -> NEVER use genesis to paper over divergence!
              summary.exceptionsCount++;
              summary.conflictCount++;
              tenantDetail.exceptions++;

              await this._recordException(
                {
                  orgId: tenantOrgId,
                  sourceType: RECONCILIATION_SOURCE_TYPES.WALLET,
                  sourceId: wallet._id,
                  domain: RECONCILIATION_DOMAINS.WALLET,
                  classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
                  reason: 'Wallet balance diverges from sum of historical transactions',
                  discrepancyDetails: {
                    expectedAmount: roundedBalance,
                    actualAmount: roundedTxnSum,
                    variance: Math.round((roundedBalance - roundedTxnSum) * 100) / 100,
                    details: { walletId: wallet._id, transactionCount: userTxns.length },
                  },
                  runId,
                },
                isDryRun,
                inMemoryExceptions,
                session
              );
            } else {
              summary.matched++;
            }
          }
        }

        executionDetails.tenantDetails.push(tenantDetail);
      }

      // If EXECUTE mode, commit transaction session
      if (!isDryRun && session) {
        await session.commitTransaction();
      }

      // Save migration run log
      const runRecord = {
        runId,
        orgId: orgId ? new mongoose.Types.ObjectId(orgId) : null,
        mode: normMode,
        status: 'COMPLETED',
        options: { allowGenesis, domains, dryRun: isDryRun },
        inventorySnapshot: inventorySnapshot.globalSummary,
        summary,
        details: executionDetails,
        startedAt: new Date(),
        completedAt: new Date(),
      };

      if (!isDryRun) {
        await HistoricalMigrationRun.create(runRecord);
      }

      return {
        runId,
        mode: normMode,
        status: 'COMPLETED',
        summary,
        details: executionDetails,
        exceptions: inMemoryExceptions,
      };
    } catch (err) {
      if (!isDryRun && session) {
        await session.abortTransaction();
      }
      logger.error('historicalReconciliation.failed', { runId, error: err.message });
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Helper to record exception into DB (in EXECUTE) or into memory (in DRY_RUN)
   */
  async _recordException(exceptionData, isDryRun, inMemoryList, session) {
    inMemoryList.push(exceptionData);
    if (!isDryRun) {
      try {
        const doc = new ReconciliationException(exceptionData);
        await doc.save(session ? { session } : undefined);
      } catch (e) {
        logger.error('Failed to persist reconciliation exception', e);
      }
    }
  }

  /**
   * List reconciliation exceptions with filters
   */
  async getExceptions({ orgId, status, domain, limit = 50, skip = 0 } = {}) {
    const query = {};
    if (orgId) query.orgId = orgId;
    if (status) query.status = status;
    if (domain) query.domain = domain;

    const [exceptions, total] = await Promise.all([
      ReconciliationException.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReconciliationException.countDocuments(query),
    ]);

    return { exceptions, total, limit, skip };
  }

  /**
   * Update exception status and notes
   */
  async updateException(exceptionId, { status, resolutionNotes, resolvedBy } = {}) {
    if (!exceptionId) throw new HttpError(400, 'Exception ID is required');

    const update = {};
    if (status) update.status = status;
    if (resolutionNotes !== undefined) update.resolutionNotes = resolutionNotes;
    if (resolvedBy) {
      update.resolvedBy = resolvedBy;
      update.resolvedAt = new Date();
    }

    const updated = await ReconciliationException.findByIdAndUpdate(exceptionId, update, { returnDocument: 'after' });
    if (!updated) throw new HttpError(404, 'Reconciliation exception not found');
    return updated;
  }
}

export const historicalReconciliationService = new HistoricalReconciliationService();
export default historicalReconciliationService;
