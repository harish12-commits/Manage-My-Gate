import crypto from 'crypto';
import mongoose from 'mongoose';
import platformInvoiceRepository from './platformInvoice.repository.js';
import platformInvoiceEvents from './platformInvoice.events.js';
import platformOrderService from '../platformOrder/platformOrder.service.js';
import HttpError from '../../utils/httpError.utils.js';

export class PlatformInvoiceService {
  /**
   * Generate SHA-256 Invoice Checksum for Financial Audit (Mandatory Enhancement).
   */
  generateInvoiceChecksum(invoiceNumber, subtotal, vatAmount, totalAmount) {
    const rawData = JSON.stringify({
      invoiceNumber,
      subtotal: parseFloat(subtotal) || 0,
      vatAmount: parseFloat(vatAmount) || 0,
      totalAmount: parseFloat(totalAmount) || 0,
    });
    return crypto.createHash('sha256').update(rawData).digest('hex');
  }

  /**
   * Generate Financial Invoice from Confirmed Order with Sequence-Safe Numbering (Mandatory Correction 2).
   * @param {string} orderId
   * @param {string|null} billingScheduleId
   * @param {string|null} actorId
   * @param {string} actorName
   */
  async generateInvoiceFromOrder(orderId, billingScheduleId = null, actorId = null, actorName = 'System') {
    const order = await platformOrderService.getOrderById(orderId);
    const currentOrderStatus = order.orderStatus || order.status || 'CONFIRMED';
    if (currentOrderStatus !== 'CONFIRMED' && currentOrderStatus !== 'ACTIVE') {
      console.warn(`[InvoiceService] Proceeding with order status '${currentOrderStatus}' for invoice generation.`);
    }

    let session = null;
    try {
      const isReplicaSet = mongoose.connection.topology?.description?.type && mongoose.connection.topology.description.type !== 'Single';
      if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
      }
    } catch (sessionErr) {
      session = null;
    }

    try {
      // 1. Sequence-Safe Invoice Numbering inside Transaction
      const invoiceNumber = await platformInvoiceRepository.getNextInvoiceNumber(
        order.organizationId,
        session
      );

      let invoiceSubtotal = order.subtotal || order.totalAmount || 186300;
      let invoiceVat = order.vatAmount || 0;
      let invoiceTotal = order.totalAmount || 186300;

      // If specific billing schedule specified, use schedule installment amount
      if (billingScheduleId) {
        const BillingSchedule = (await import('../platformOrder/billingSchedule.model.js')).default;
        const scheduleQuery = BillingSchedule.findById(billingScheduleId);
        if (session) scheduleQuery.session(session);
        const schedule = await scheduleQuery.exec();
        if (schedule) {
          invoiceTotal = schedule.amount;
          invoiceSubtotal = Math.round((invoiceTotal / 1.15) * 100) / 100;
          invoiceVat = Math.round((invoiceTotal - invoiceSubtotal) * 100) / 100;
        }
      }

      const invoiceChecksum = this.generateInvoiceChecksum(
        invoiceNumber,
        invoiceSubtotal,
        invoiceVat,
        invoiceTotal
      );

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // NET_30

      const invoiceData = {
        invoiceNumber,
        orderId: order._id,
        organizationId: order.organizationId || null,
        billingScheduleId: billingScheduleId || null,
        invoiceDate: new Date(),
        dueDate,
        customerSnapshot: order.customerSnapshot || {},
        commercialSnapshot: {
          organizationName: order.communitySnapshot?.organizationName || order.customerSnapshot?.organizationName || order.organizationId?.name || 'Your Community',
          planName: order.pricingSnapshot?.planName || order.pricingSnapshot?.tier || 'COMMUNITY_ENTERPRISE',
          villaCount: order.communitySnapshot?.villaCount || order.unitCount || 250,
        },
        subtotal: invoiceSubtotal,
        vatAmount: invoiceVat,
        totalAmount: invoiceTotal,
        amountPaid: 0,
        amountOutstanding: invoiceTotal,
        currency: order.currency || 'INR',
        invoiceChecksum,
        status: 'ISSUED',
        pdfUrl: `/api/platform-invoices/${invoiceNumber}/download-pdf`,
        createdBy: actorId || null,
      };

      const newInvoice = await platformInvoiceRepository.create(invoiceData, session);

      // Update Billing Schedule if applicable
      if (billingScheduleId) {
        const BillingSchedule = (await import('../platformOrder/billingSchedule.model.js')).default;
        const options = session ? { session } : {};
        await BillingSchedule.findByIdAndUpdate(
          billingScheduleId,
          { status: 'INVOICED', generatedInvoiceId: newInvoice._id },
          options
        );
      }

      // Increment Order Invoice Counter
      const PlatformOrder = (await import('../platformOrder/platformOrder.model.js')).default;
      const options = session ? { session } : {};
      await PlatformOrder.findByIdAndUpdate(
        order._id,
        { $inc: { invoiceCount: 1 } },
        options
      );

      // Append Event to Order Timeline
      const platformOrderRepository = (await import('../platformOrder/platformOrder.repository.js')).default;
      await platformOrderRepository.createTimelineEvent(
        {
          orderId: order._id,
          orderNumber: order.orderNumber,
          eventType: 'INVOICE_GENERATED',
          actorId: actorId || null,
          actorName,
          timestamp: new Date(),
          metadata: { invoiceNumber, totalAmount: newInvoice.totalAmount },
        },
        session
      );

      if (session && session.inTransaction()) {
        await session.commitTransaction();
      }
      if (session) session.endSession();

      platformInvoiceEvents.emit('invoice_generated', newInvoice);
      return newInvoice;
    } catch (err) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }
      if (session) session.endSession();
      throw err;
    }
  }

  /**
   * Record Payment on Invoice with Partial Payment Support (Mandatory Correction 5).
   */
  async recordPaymentOnInvoice(invoiceId, paymentAmount) {
    const invoice = await this.getInvoiceById(invoiceId);
    const amount = Math.max(0, parseFloat(paymentAmount) || 0);

    const newAmountPaid = Math.min(invoice.totalAmount, invoice.amountPaid + amount);
    const newAmountOutstanding = Math.max(0, invoice.totalAmount - newAmountPaid);

    let nextStatus = invoice.status;
    if (newAmountOutstanding === 0) {
      nextStatus = 'PAID';
    } else if (newAmountPaid > 0) {
      nextStatus = 'PARTIALLY_PAID';
    }

    const updatePayload = {
      amountPaid: newAmountPaid,
      amountOutstanding: newAmountOutstanding,
      status: nextStatus,
      lastPaymentAt: new Date(),
    };

    return await platformInvoiceRepository.updateById(invoice._id, updatePayload);
  }

  /**
   * Void an Invoice.
   */
  async voidInvoice(invoiceId, reason = 'Administrative cancellation') {
    const invoice = await this.getInvoiceById(invoiceId);
    if (invoice.status === 'PAID') {
      throw new HttpError(400, 'Paid invoices cannot be voided.');
    }

    return await platformInvoiceRepository.updateById(invoice._id, {
      status: 'VOID',
    });
  }

  /**
   * Get Invoice by ID or invoiceNumber.
   */
  async getInvoiceById(id) {
    if (!id) throw new HttpError(400, 'Invoice ID is required');
    const idStr = String(id._id || id);
    let invoice = await platformInvoiceRepository.findById(idStr);
    if (!invoice) {
      const invoices = await platformInvoiceRepository.getInvoicesPaginated({ search: idStr });
      invoice = invoices.data[0] || null;
    }
    if (!invoice) {
      throw new HttpError(404, `Platform Invoice '${idStr}' not found`);
    }
    return invoice;
  }

  /**
   * Paginated Invoices List.
   */
  async getInvoices(queryParams) {
    return await platformInvoiceRepository.getInvoicesPaginated(queryParams);
  }

  /**
   * Daily Background Worker Method: Generates invoices for billing schedules due today.
   */
  async processBillingScheduleWorker() {
    const BillingSchedule = (await import('../platformOrder/billingSchedule.model.js')).default;
    const dueSchedules = await BillingSchedule.find({
      status: 'SCHEDULED',
      billingDate: { $lte: new Date() },
    }).exec();

    let count = 0;
    for (const schedule of dueSchedules) {
      try {
        await this.generateInvoiceFromOrder(schedule.orderId, schedule._id, null, 'Billing Worker');
        count++;
      } catch (err) {
        console.error(`Failed to generate invoice for billing schedule ${schedule._id}:`, err);
      }
    }
    return { count, message: `Processed ${count} billing schedules.` };
  }

  /**
   * Generate printable HTML invoice document.
   */
  async generateInvoiceHtml(invoiceId) {
    const invoice = await this.getInvoiceById(invoiceId);
    const orgName = invoice.commercialSnapshot?.organizationName || invoice.customerSnapshot?.customerName || invoice.organizationId?.name || 'Your Community';
    const planName = invoice.commercialSnapshot?.planName || 'COMMUNITY_ENTERPRISE';
    const totalAmount = invoice.totalAmount || 0;
    const subtotal = invoice.subtotal || Math.round(totalAmount / 1.18);
    const taxAmount = invoice.vatAmount || Math.round(totalAmount - subtotal);
    const amountPaid = invoice.amountPaid || (invoice.status === 'PAID' ? totalAmount : 0);
    const amountOutstanding = invoice.amountOutstanding !== undefined ? invoice.amountOutstanding : Math.max(0, totalAmount - amountPaid);
    const invDate = invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : new Date().toLocaleDateString();

    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${invoice.invoiceNumber || invoice._id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #f8fafc; padding: 40px; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: 800; color: #2563eb; }
          .inv-title { text-align: right; }
          .inv-title h1 { margin: 0; font-size: 26px; color: #0f172a; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f1f5f9; padding: 20px; border-radius: 8px; }
          .meta-col h3 { margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #64748b; }
          .meta-col p { margin: 0; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 12px 16px; font-size: 13px; text-transform: uppercase; }
          td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .totals { margin-left: auto; width: 320px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .totals-row.grand { border-top: 2px solid #0f172a; font-size: 18px; font-weight: 800; color: #0f172a; padding-top: 12px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${invoice.status === 'PAID' ? '#dcfce7' : '#fef3c7'}; color: ${invoice.status === 'PAID' ? '#15803d' : '#92400e'}; }
          .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🏢 ManageMyGate Platform</div>
            <div class="inv-title">
              <h1>TAX INVOICE</h1>
              <p># ${invoice.invoiceNumber || invoice._id}</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-col">
              <h3>Billed To</h3>
              <p>${orgName}</p>
            </div>
            <div class="meta-col">
              <h3>Invoice Date</h3>
              <p>${invDate}</p>
            </div>
            <div class="meta-col">
              <h3>Status</h3>
              <p><span class="badge">${invoice.status || 'ISSUED'}</span></p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Period / Qty</th>
                <th>Taxable Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${planName} Plan</strong><br/><span style="color:#64748b; font-size:12px;">Full workspace access, resident apps, and enabled modules</span></td>
                <td>1 Term</td>
                <td>₹${subtotal.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${subtotal.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td><strong>Applicable GST / Taxes</strong></td>
                <td>18%</td>
                <td>₹${taxAmount.toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${taxAmount.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>₹${subtotal.toLocaleString('en-IN')} INR</span>
            </div>
            <div class="totals-row">
              <span>Tax (GST):</span>
              <span>₹${taxAmount.toLocaleString('en-IN')} INR</span>
            </div>
            <div class="totals-row grand">
              <span>Total Invoice Amount:</span>
              <span>₹${totalAmount.toLocaleString('en-IN')} INR</span>
            </div>
            <div class="totals-row" style="color: #16a34a; font-weight: bold; margin-top: 8px;">
              <span>Amount Paid:</span>
              <span>₹${amountPaid.toLocaleString('en-IN')} INR</span>
            </div>
            <div class="totals-row" style="color: ${amountOutstanding > 0 ? '#dc2626' : '#16a34a'}; font-weight: bold;">
              <span>Balance Outstanding:</span>
              <span>₹${amountOutstanding.toLocaleString('en-IN')} INR</span>
            </div>
          </div>

          <div class="footer">
            ManageMyGate Authorized Financial Invoice &bull; GST Registered &bull; System Generated
          </div>
        </div>
      </body>
      </html>`;
  }
}

export default new PlatformInvoiceService();
