import { paymentEventEmitter, PAYMENT_SUCCESS } from '../payment/payment.events.js';
import invoiceService from './invoice.services.js';
import logger from '../../utils/logger.utils.js';
import Invoice from './invoice.model.js';
import { retireActivePaymentLink } from './invoicePayLink.service.js';

/**
 * Register background event listeners for the Invoice module.
 */
const isInvoicePayment = (payment) => payment?.referenceType === 'Invoice' || payment?.domain === 'INVOICE';

export const registerInvoiceListeners = () => {
  // Any successful invoice payment (app, wallet, cash, bank approval or the link itself) makes the
  // outstanding Razorpay link stale: retire it so the resident can't pay the old amount again.
  paymentEventEmitter.on(PAYMENT_SUCCESS, async (payment) => {
    if (!isInvoicePayment(payment)) return;
    const invoiceId = payment.invoiceId || payment.referenceId;
    if (!invoiceId) return;
    try {
      await retireActivePaymentLink(invoiceId);
    } catch (err) {
      logger.warn('Failed to retire payment link after invoice payment', { invoiceId: String(invoiceId), error: err.message });
    }
  });

  paymentEventEmitter.on(PAYMENT_SUCCESS, async (payment, options = {}) => {
    if (options.alreadySettled) {
      logger.info(`Skipping PAYMENT_SUCCESS listener for Invoice ${payment.referenceId} as it was settled in transaction.`);
      return;
    }
    if (payment.referenceType === 'Invoice') {
      try {
        logger.info(`Processing PAYMENT_SUCCESS for Invoice ${payment.referenceId}`);
        // Avoid double processing if already paid
        const invoice = await Invoice.findById(payment.referenceId);
        if (invoice && invoice.status !== 'PAID') {
           let methodToUse = payment.paymentMethod;
           const validMethods = ['UPI', 'CARD', 'NETBANKING', 'BANK_TRANSFER', 'NEFT', 'CASH', 'WALLET', 'RAZORPAY'];
           if (!methodToUse || methodToUse === 'credit_card' || !validMethods.includes(methodToUse)) {
             methodToUse = 'RAZORPAY';
           }

           await invoiceService.settleInvoicePayment(payment.referenceId, {
             paymentMethod: methodToUse,
             amount: payment.amount,
             paid_at: new Date(),
             settled_at: new Date(),
             offlineReference: payment.gatewayTransactionId,
           });
           logger.info(`Successfully settled Invoice ${payment.referenceId} via PAYMENT_SUCCESS event`);
        } else {
           logger.info(`Invoice ${payment.referenceId} is already PAID or not found. Skipping settlement.`);
        }
      } catch (err) {
        logger.error('Failed to handle PAYMENT_SUCCESS for invoice', err);
      }
    }
  });
};

// Auto-register immediately upon import
registerInvoiceListeners();
