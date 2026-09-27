import PaymentContextFactory from '../paymentContext.factory.js';
import {
  toLegacyPaymentStatus,
  toLegacyPaymentMethod,
  toCanonicalPaymentStatus,
  toCanonicalPaymentMethod,
  PAYMENT_DOMAINS,
  PAYMENT_REFERENCE_TYPES,
} from '../payment.constants.js';

/**
 * BillingPaymentAdapter
 * Bridge adapter between the Invoicing/Billing feature and the unified payment layer.
 */
export class BillingPaymentAdapter {
  /**
   * Create a canonical PaymentContext from an invoice.
   * @param {object} invoice
   * @param {object} [options={}]
   * @returns {import('../payment.types.js').PaymentContext}
   */
  createPaymentContext(invoice, options = {}) {
    return PaymentContextFactory.fromInvoice(invoice, options);
  }

  /**
   * Format payment initialization arguments suitable for payment order creation.
   * @param {import('../payment.types.js').PaymentContext} paymentContext
   * @param {object} [options={}]
   * @returns {object}
   */
  formatPaymentCreationParams(paymentContext, options = {}) {
    return {
      orgId: paymentContext.orgId,
      userId: paymentContext.userId,
      referenceId: paymentContext.referenceId,
      referenceType: paymentContext.referenceType || PAYMENT_REFERENCE_TYPES.INVOICE,
      amount: paymentContext.amount,
      currency: paymentContext.currency,
      gateway: options.gateway || 'razorpay',
    };
  }

  /**
   * Format invoice settlement update payload.
   * @param {import('../payment.types.js').PaymentContext} paymentContext
   * @param {object} paymentResult - Recorded payment entity or payment service result
   * @returns {object}
   */
  formatSettlementPayload(paymentContext, paymentResult = {}) {
    const amountPaid = paymentResult.amount !== undefined ? Number(paymentResult.amount) : paymentContext.amount;
    const paymentId = paymentResult._id || paymentResult.paymentId || null;
    const transactionId = paymentResult.gatewayTransactionId || paymentResult.orderId || null;

    return {
      invoiceId: paymentContext.referenceId,
      amountPaid,
      currency: paymentContext.currency,
      paymentMethod: paymentContext.paymentMethod,
      transactionId,
      paymentId,
      settledAt: paymentResult.updatedAt || new Date(),
      auditEntry: {
        action: 'PAYMENT_RECORDED',
        details: `Payment of ₹${amountPaid} recorded via ${paymentContext.paymentMethod}. Transaction: ${transactionId || 'N/A'}`,
        date: new Date(),
        performedBy: paymentContext.payerUserId || paymentContext.userId,
      },
    };
  }

  /**
   * Convert canonical status to invoice legacy status.
   * @param {string} canonicalStatus
   * @param {boolean} [isOffline=false]
   * @returns {string}
   */
  toLegacyStatus(canonicalStatus, isOffline = false) {
    return toLegacyPaymentStatus(canonicalStatus, 'Invoice', { isOffline });
  }

  /**
   * Convert canonical method to invoice legacy method.
   * @param {string} canonicalMethod
   * @returns {string}
   */
  toLegacyMethod(canonicalMethod) {
    return toLegacyPaymentMethod(canonicalMethod, 'Invoice');
  }

  /**
   * Convert invoice status to canonical status.
   * @param {string} invoiceStatus
   * @returns {string}
   */
  toCanonicalStatus(invoiceStatus) {
    return toCanonicalPaymentStatus(invoiceStatus, PAYMENT_DOMAINS.INVOICE);
  }

  /**
   * Convert invoice method to canonical method.
   * @param {string} invoiceMethod
   * @returns {string}
   */
  toCanonicalMethod(invoiceMethod) {
    return toCanonicalPaymentMethod(invoiceMethod);
  }
}

export const billingPaymentAdapter = new BillingPaymentAdapter();
export default billingPaymentAdapter;
