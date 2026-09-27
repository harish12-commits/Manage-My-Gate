import DomainSettlementInterface from './DomainSettlementInterface.js';
import logger from '../../../utils/logger.utils.js';

export class InvoiceSettlementHandler extends DomainSettlementInterface {
  async settle(payment, session) {
    logger.info('Executing Invoice settlement', {
      invoiceId: payment.referenceId,
      paymentId: payment._id,
      amount: payment.amount,
    });

    const invoiceService = (await import('../../invoice/invoice.services.js')).default;

    let invoicePaymentMethod = (payment.paymentMethod || 'RAZORPAY').toUpperCase();
    const validInvoiceMethods = [
      'UPI',
      'CARD',
      'NETBANKING',
      'BANK_TRANSFER',
      'NEFT',
      'CASH',
      'WALLET',
      'RAZORPAY',
      'CHEQUE',
      'DEMAND_DRAFT',
    ];
    if (!validInvoiceMethods.includes(invoicePaymentMethod)) {
      if (invoicePaymentMethod.includes('CARD')) {
        invoicePaymentMethod = 'CARD';
      } else if (invoicePaymentMethod.includes('BANK') || invoicePaymentMethod.includes('TRANSFER')) {
        invoicePaymentMethod = 'BANK_TRANSFER';
      } else if (invoicePaymentMethod.includes('WALLET')) {
        invoicePaymentMethod = 'WALLET';
      } else if (invoicePaymentMethod.includes('UPI')) {
        invoicePaymentMethod = 'UPI';
      } else {
        invoicePaymentMethod = 'RAZORPAY';
      }
    }

    const paymentData = {
      amount: payment.amount,
      paymentMethod: invoicePaymentMethod,
      paid_at: new Date(),
      settled_at: new Date(),
      offlineReference: payment.gatewayTransactionId || String(payment._id),
    };

    const updatedInvoice = await invoiceService.settleInvoicePayment(
      payment.referenceId,
      paymentData,
      session
    );

    return updatedInvoice;
  }

  async refund(payment, refundRecord, session) {
    logger.info('Executing Invoice refund settlement', {
      invoiceId: payment.referenceId,
      refundId: refundRecord._id,
      amount: refundRecord.amount,
    });

    const Invoice = (await import('../../invoice/invoice.model.js')).default;
    const Payment = (await import('../payment.model.js')).default;

    const query = Invoice.findById(payment.referenceId);
    if (session) query.session(session);
    const invoice = await query;

    if (!invoice) {
      logger.warn(`Invoice ${payment.referenceId} not found during refund settlement`);
      return null;
    }

    // Re-sum all successful payments and refunds for this invoice within transaction
    const paymentQuery = Payment.find({
      referenceId: invoice._id,
      status: 'success',
      isDeleted: false,
    });
    if (session) paymentQuery.session(session);
    const allPayments = await paymentQuery;

    const sumPaid = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalLiability = Number(invoice.totalDue || invoice.totalAmount || 0);

    invoice.paidAmount = Math.max(0, sumPaid);
    invoice.outstandingAmount = Math.max(0, totalLiability - invoice.paidAmount);
    invoice.status = invoice.outstandingAmount <= 0.01 ? 'PAID' : (invoice.paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    invoice.auditHistory = invoice.auditHistory || [];
    invoice.auditHistory.push({
      action: 'PAYMENT_REFUNDED',
      details: `Refund of ₹${Math.abs(refundRecord.amount)} processed. Net Paid Amount: ₹${invoice.paidAmount}`,
      date: new Date(),
      performedBy: refundRecord.userId || null,
    });

    await invoice.save(session ? { session } : undefined);
    return invoice;
  }
}

export default new InvoiceSettlementHandler();
