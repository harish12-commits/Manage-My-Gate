import { paymentEventEmitter, PAYMENT_SUCCESS } from '../payment/payment.events.js';
import invoiceService from './invoice.services.js';
import logger from '../../utils/logger.utils.js';
import Invoice from './invoice.model.js';
import { retireActivePaymentLink } from './invoicePayLink.service.js';
import { enqueueInvoiceEmail } from './invoice.email.js';
import { invoiceEventEmitter, INVOICE_GENERATED } from './invoice.events.js';

/**
 * Register background event listeners for the Invoice module.
 */
const isInvoicePayment = (payment) => payment?.referenceType === 'Invoice' || payment?.domain === 'INVOICE';

// Settlement may finish just after PAYMENT_SUCCESS (listener-driven path); give it a moment so the
// receipt shows the updated balance.
const RECEIPT_DELAY_MS = 1500;

export const registerInvoiceListeners = () => {
  invoiceEventEmitter.on(INVOICE_GENERATED, (payload) => {
    const invoiceId = payload?.invoiceId || payload?._id;
    if (invoiceId) enqueueInvoiceEmail('generated', invoiceId);
  });

  paymentEventEmitter.on(PAYMENT_SUCCESS, (payment) => {
    if (!isInvoicePayment(payment) || payment.status === 'failed') return;
    const invoiceId = payment.invoiceId || payment.referenceId;
    if (!invoiceId) return;
    setTimeout(() => enqueueInvoiceEmail('receipt', invoiceId, { payment }), RECEIPT_DELAY_MS);
  });

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
