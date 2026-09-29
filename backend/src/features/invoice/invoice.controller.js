import crypto from 'crypto';
import invoiceService from './invoice.services.js';
import HttpError from '../../utils/httpError.utils.js';

export class InvoiceController {
  /**
   * Fetch personal outstanding dues and compliance info for a user.
   */
  async getMyDues(req, res, next) {
    try {
      // Resolve optional communityId from query, x-organization-id header, or tenant context
      const communityId =
        req.query.communityId ||
        req.headers['x-organization-id'] ||
        req.tenant?.orgId ||
        req.user?.activeOrganizationId ||
        req.user?.orgId ||
        req.user?.communityId ||
        null;

      const data = await invoiceService.getUserDuesOverview(req.user, communityId);
      res.success(data, 'Outstanding dues retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually trigger billing generation for ad-hoc / missed cycles.
   */
  async triggerManual(req, res, next) {
    try {
      const data = await invoiceService.triggerManualBilling(req.body);
      res.success(data, 'Manual billing cycle generated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend WhatsApp links for existing unpaid invoices of an assessment.
   */
  async triggerWhatsApp(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { assessmentId, billingPeriodString } = req.body;
      const data = await invoiceService.resendWhatsAppLinks(assessmentId, billingPeriodString, orgId);
      res.success(data, 'WhatsApp links resent successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit offline payment for verification (Resident).
   */
  async settleOffline(req, res, next) {
    try {
      const { id } = req.params;
      const { paymentReference, offlineReference, amountPaid, amount, offlineAmount, paymentMethod, paymentDate, paymentScreenshot, payerNotes } = req.body;
      const refToUse = paymentReference || offlineReference;
      const amountToUse = amountPaid !== undefined ? amountPaid : (offlineAmount !== undefined ? offlineAmount : amount);
      const data = await invoiceService.logOfflinePayment(id, refToUse, amountToUse, paymentMethod || 'BANK_TRANSFER', paymentDate, paymentScreenshot, payerNotes);
      res.success(data, 'Offline payment details submitted successfully and pending verification.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload offline payment proof attachment (receipt / screenshot / cheque).
   */
  async uploadProof(req, res, next) {
    try {
      if (!req.file) {
        throw new HttpError(400, 'No proof document file uploaded');
      }
      const fileUrl = `/uploads/invoices/${req.file.filename}`;
      res.success({ url: fileUrl }, 'Payment proof uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve a pending Bank Transfer payment (Admin only).
   */
  async approvePayment(req, res, next) {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.id || req.user?._id;
      const { amount, settlementType, paymentMethod, paymentReference, reference, notes, paymentScreenshot } = req.body || {};
      const data = await invoiceService.approveOfflinePayment(id, adminUserId, {
        amount,
        settlementType,
        paymentMethod,
        paymentReference,
        reference,
        notes,
        paymentScreenshot,
      });
      res.success(data, 'Offline payment verified and confirmed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject a pending Bank Transfer payment (Admin only).
   */
  async rejectPayment(req, res, next) {
    try {
      const { id } = req.params;
      const adminUserId = req.user?.id || req.user?._id;
      const rejectionReason = req.body?.rejectionReason || req.body?.reason || '';
      const data = await invoiceService.rejectOfflinePayment(id, adminUserId, rejectionReason);
      res.success(data, 'Bank transfer payment rejected.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record Cash payment directly (Facility In-Charge / Admin).
   */
  async recordCashPayment(req, res, next) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const facilityUserId = req.user?.id || req.user?._id;
      const data = await invoiceService.recordCashPayment(id, amount, facilityUserId);
      res.success(data, 'Cash payment recorded and receipt generated successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Universal search box for eligible unpaid invoices for Cash collection.
   */
  async searchCashEligible(req, res, next) {
    try {
      const orgId = req.tenant.orgId;
      const { q } = req.query;
      const data = await invoiceService.searchCashEligible(q, orgId);
      res.success(data, 'Eligible invoices for cash collection retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Cash collection history for facility in-charge.
   */
  async getCashCollections(req, res, next) {
    try {
      const orgId = req.tenant?.orgId;
      const facilityUserId = req.user?.id || req.user?._id;
      const data = await invoiceService.getCashCollections(facilityUserId, orgId, req.query);
      res.success(data, 'Cash collections history retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch aggregated community billing dashboard metrics.
   */
  async getDashboardKPIs(req, res, next) {
    try {
      const orgId = req.query.communityId || req.tenant.orgId;
      const data = await invoiceService.getDashboardKPIs(orgId);
      res.success(data, 'Dashboard billing KPIs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch all invoices for a community (filtered & paginated).
   */
  async getAllInvoices(req, res, next) {
    try {
      const orgId = req.query.communityId || req.tenant.orgId;
      const data = await invoiceService.getInvoices(orgId, req.query);
      res.success(data, 'Community invoices retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Razorpay Webhooks using raw body for accurate HMAC signature verification
   */
  async handleRazorpayWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!signature || !secret) {
        return res.status(400).json({ error: 'Missing signature or secret' });
      }

      const rawPayload = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawPayload)
        .digest('hex');

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      const isValid = sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid signature' });
      }

      if (req.body.event === 'payment_link.paid') {
        // Regenerated links use reference_id "<invoiceId>-<n>" (Razorpay needs unique ids); notes carry the plain id.
        const linkEntity = req.body.payload.payment_link.entity;
        const reference_id = linkEntity.notes?.invoiceId || String(linkEntity.reference_id || '').split('-')[0];
        const payment_id = req.body.payload.payment?.entity?.id || req.body.payload.payment_link?.entity?.payment_id;
        
        // Razorpay amounts are in paise, divide by 100
        const amount_paid_paise = req.body.payload.payment?.entity?.amount || req.body.payload.payment_link?.entity?.amount_paid || 0;
        const amount_paid = amount_paid_paise / 100;
        
        await invoiceService.settleInvoiceFromWebhook(reference_id, {
          paymentId: payment_id,
          method: 'RAZORPAY',
          amount: amount_paid
        });
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await invoiceService.getInvoiceById(id);
      res.success(data, 'Invoice retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  // --- Phase 1.5 Enterprise Route Stubs ---
  
  async downloadInvoicePdf(req, res, next) {
    try {
      // Stub: Generate and return PDF buffer
      res.status(501).json({ message: 'Invoice PDF generation not yet implemented in this phase' });
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceTimeline(req, res, next) {
    try {
      const invoiceId = req.params.id;
      // Stub: Return auditHistory and payment ledgers
      res.status(501).json({ message: 'Timeline retrieval not yet implemented in this phase' });
    } catch (error) {
      next(error);
    }
  }

  async regeneratePaymentLink(req, res, next) {
    try {
      const invoiceId = req.params.id;
      // Stub: Expire old link, generate new, update invoice, dispatch event
      res.status(501).json({ message: 'Payment link regeneration not yet implemented in this phase' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send an in-app reminder to resident for an individual invoice.
   */
  async sendInvoiceReminder(req, res, next) {
    try {
      const { id } = req.params;
      const adminUserId = req.user?._id;
      const orgId = req.tenant?.orgId;
      const result = await invoiceService.sendInvoiceReminder(id, adminUserId, orgId);
      res.success(result, 'Invoice reminder sent successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send an in-app portfolio reminder to resident for their total dues.
   */
  async notifyResidentPortfolio(req, res, next) {
    try {
      const adminUserId = req.user?._id;
      const orgId = req.tenant?.orgId;
      const result = await invoiceService.notifyResidentPortfolio(req.body, adminUserId, orgId);
      res.success(result, 'Resident reminder sent successfully');
    } catch (error) {
      next(error);
    }
  }

}

export default new InvoiceController();
