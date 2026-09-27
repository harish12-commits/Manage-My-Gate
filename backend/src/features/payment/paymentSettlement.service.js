import mongoose from 'mongoose';
import Payment from './payment.model.js';
import settlementHandlerRegistry from './settlement/index.js';
import { resolvePaymentDomain } from './payment.utils.js';
import { paymentEventEmitter, PAYMENT_SUCCESS, PAYMENT_REFUNDED } from './payment.events.js';
import HttpError from '../../utils/httpError.utils.js';
import logger from '../../utils/logger.utils.js';

/**
 * Payment Settlement Service
 * Orchestrates atomic, transaction-bounded financial settlement across domain entities
 * (Invoice, AmenityBooking, WalletRecharge).
 * 
 * CRITICAL RULE: Emits events ONLY after database transactions are committed.
 */
export class PaymentSettlementService {
  /**
   * Authoritatively settle a payment into SUCCESS state and execute domain settlement atomically.
   * @param {object} params
   * @param {string|object} params.paymentId - Payment record ID
   * @param {string} [params.gatewayTransactionId] - Gateway payment ID
   * @param {string} [params.gatewayOrderId] - Gateway order ID
   * @param {string} [params.gatewayEventId] - Unique webhook event identifier
   * @param {string} [params.paymentMethod] - Normalized payment method
   * @param {import('mongoose').ClientSession} [params.session] - Optional outer session
   * @returns {Promise<{ success: boolean, alreadySettled: boolean, payment: object, domainResult?: object }>}
   */
  async settlePayment({
    paymentId,
    gatewayTransactionId = null,
    gatewayOrderId = null,
    gatewayEventId = null,
    paymentMethod = null,
    session: outerSession = null,
  }) {
    logger.info('payment.settlement.started', { paymentId, gatewayTransactionId, gatewayOrderId, gatewayEventId });

    let session = outerSession;
    let isLocalSession = false;

    if (!session) {
      session = await mongoose.startSession();
      isLocalSession = true;
      try {
        session.startTransaction();
      } catch (err) {
        logger.debug('Transaction start skipped (standalone MongoDB mode)', { error: err.message });
      }
    }

    try {
      const activeSession = session && typeof session.inTransaction === 'function' && session.inTransaction() ? session : null;

      // 1. Fetch Payment record within transaction
      const paymentQuery = Payment.findById(paymentId);
      if (activeSession) paymentQuery.session(activeSession);
      const payment = await paymentQuery;

      if (!payment) {
        throw new HttpError(404, `Payment record ${paymentId} not found.`);
      }

      // 2. Idempotency Check 1: Already settled
      if (payment.status === 'success') {
        logger.info('payment.settlement.duplicate', {
          paymentId: payment._id,
          gatewayTransactionId,
          reason: 'Payment already marked success',
        });

        if (isLocalSession) {
          if (session.inTransaction()) await session.commitTransaction();
          session.endSession();
        }
        return { success: true, alreadySettled: true, payment };
      }

      // 3. Idempotency Check 2: Gateway event already processed
      if (gatewayEventId && payment.processedEvents?.some((e) => e.eventId === gatewayEventId)) {
        logger.info('payment.settlement.duplicate', {
          paymentId: payment._id,
          gatewayEventId,
          reason: 'Event ID already processed',
        });

        if (isLocalSession) {
          if (session.inTransaction()) await session.commitTransaction();
          session.endSession();
        }
        return { success: true, alreadySettled: true, payment };
      }

      // 4. Resolve Domain
      const domain = resolvePaymentDomain(payment);
      const handler = settlementHandlerRegistry.getHandler(domain);

      // 5. Update Payment Record to SUCCESS inside transaction
      payment.status = 'success';
      if (gatewayTransactionId) payment.gatewayTransactionId = gatewayTransactionId;
      if (gatewayOrderId) payment.gatewayOrderId = gatewayOrderId;
      if (paymentMethod) payment.paymentMethod = paymentMethod;
      if (gatewayEventId) {
        payment.processedEvents = payment.processedEvents || [];
        payment.processedEvents.push({
          eventId: gatewayEventId,
          eventType: 'payment.captured',
          processedAt: new Date(),
        });
      }
      payment.errorReason = null;

      await payment.save(activeSession ? { session: activeSession } : undefined);

      // 6. Execute Domain Settlement inside the same transaction session
      const domainResult = await handler.settle(payment, activeSession);

      // 6.5 Record Double-Entry Financial Ledger Entry inside the SAME session
      let ledgerEntry = null;
      try {
        const financialLedgerService = (await import('../ledger/financialLedger.service.js')).default;
        ledgerEntry = await financialLedgerService.recordSettlementLedgerEntry(
          payment,
          domain,
          activeSession
        );
      } catch (ledgerErr) {
        logger.error('payment.settlement.ledger_failed', { paymentId: payment._id, error: ledgerErr.message });
        throw ledgerErr;
      }

      // 7. Commit Transaction
      if (isLocalSession) {
        if (session.inTransaction()) {
          await session.commitTransaction();
        }
        session.endSession();
      }

      logger.info('payment.settlement.success', {
        paymentId: payment._id,
        domain,
        referenceId: payment.referenceId,
        amount: payment.amount,
      });

      // 8. CRITICAL: Emit events ONLY AFTER COMMIT
      paymentEventEmitter.emit(PAYMENT_SUCCESS, payment, { domainResult });

      return {
        success: true,
        alreadySettled: false,
        payment,
        domainResult,
        ledgerEntry,
      };
    } catch (error) {
      if (isLocalSession) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();
      }

      // Check if another concurrent transaction already settled this payment
      if (
        error.code === 112 ||
        error.code === 11000 ||
        error.name === 'VersionError' ||
        error.hasErrorLabel?.('TransientTransactionError')
      ) {
        const freshPayment = await Payment.findById(paymentId);
        if (freshPayment && freshPayment.status === 'success') {
          logger.info('payment.settlement.concurrent_settled', { paymentId });
          return {
            success: true,
            alreadySettled: true,
            payment: freshPayment,
          };
        }
      }

      logger.error('payment.settlement.failed', { paymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Settle a refund atomically inside a transaction.
   * @param {object} params
   * @param {object} params.originalPayment
   * @param {object} params.refundRecord
   * @param {import('mongoose').ClientSession} [params.session]
   * @returns {Promise<object>}
   */
  async settleRefund({ originalPayment, refundRecord, session: outerSession = null }) {
    logger.info('payment.refund.settlement.started', {
      originalPaymentId: originalPayment._id,
      refundId: refundRecord._id,
      amount: refundRecord.amount,
    });

    let session = outerSession;
    let isLocalSession = false;

    if (!session) {
      session = await mongoose.startSession();
      isLocalSession = true;
      try {
        session.startTransaction();
      } catch (err) {
        logger.debug('Transaction start skipped in settleRefund', { error: err.message });
      }
    }

    try {
      const activeSession = session && typeof session.inTransaction === 'function' && session.inTransaction() ? session : null;

      const domain = resolvePaymentDomain(originalPayment);
      const handler = settlementHandlerRegistry.getHandler(domain);

      // Execute domain refund adjustments
      const domainResult = await handler.refund(originalPayment, refundRecord, activeSession);

      // Record compensating double-entry ledger entry inside the same session
      let ledgerEntry = null;
      try {
        const financialLedgerService = (await import('../ledger/financialLedger.service.js')).default;
        ledgerEntry = await financialLedgerService.recordRefundLedgerEntry(
          originalPayment,
          refundRecord,
          domain,
          activeSession
        );
      } catch (ledgerErr) {
        logger.error('payment.refund.ledger_failed', { refundId: refundRecord._id, error: ledgerErr.message });
        throw ledgerErr;
      }

      if (isLocalSession) {
        if (session.inTransaction()) {
          await session.commitTransaction();
        }
        session.endSession();
      }

      logger.info('payment.refund.settlement.success', {
        originalPaymentId: originalPayment._id,
        refundId: refundRecord._id,
      });

      // Emit event AFTER commit
      paymentEventEmitter.emit(PAYMENT_REFUNDED, refundRecord, { originalPayment, domainResult, ledgerEntry });

      return {
        success: true,
        refund: refundRecord,
        domainResult,
        ledgerEntry,
      };
    } catch (error) {
      if (isLocalSession) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();
      }
      logger.error('payment.refund.settlement.failed', {
        originalPaymentId: originalPayment._id,
        error: error.message,
      });
      throw error;
    }
  }
}

export const paymentSettlementService = new PaymentSettlementService();
export default paymentSettlementService;
