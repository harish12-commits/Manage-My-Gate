import Payment from './payment.model.js';
import paymentRepository from './payment.repository.js';
import {
  paymentEventEmitter,
  PAYMENT_INITIATED,
  PAYMENT_SUCCESS,
  PAYMENT_FAILED,
  PAYMENT_REFUNDED,
} from './payment.events.js';
import unifiedPaymentService from './unifiedPayment.service.js';
import paymentConfigResolver from './paymentConfig.resolver.js';
import { PaymentContext } from './payment.types.js';
import { resolvePaymentDomain } from './payment.utils.js';
import { CANONICAL_PAYMENT_METHODS } from './payment.constants.js';
import { formatINR } from './utils/currency.utils.js';
import integrationHubService from '../integrationHub/integrationHub.service.js';
import Razorpay from 'razorpay';
import HttpError from '../../utils/httpError.utils.js';
import logger from '../../utils/logger.utils.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

export class PaymentService {
  /**
   * Rehydrates a previously-created Razorpay order for a safe checkout retry.
   * Reusing the pending order prevents a resident from being charged twice by
   * repeatedly opening checkout for the same reservation hold.
   */
  async getCheckoutDetails(payment) {
    if (!payment || payment.gateway !== 'razorpay' || payment.status !== 'pending') {
      throw new HttpError(400, 'This payment is not available for checkout.');
    }

    const credentials = await integrationHubService.getDecryptedCredentials(payment.orgId, 'razorpay');
    const razorpayKeyId = credentials?.keyId || credentials?.key_id;
    if (!razorpayKeyId) {
      throw new HttpError(400, 'Razorpay credentials configured for your community are invalid. Please contact your community admin.');
    }

    return {
      success: true,
      paymentId: payment._id,
      orderId: payment.gatewayTransactionId,
      amount: payment.amount,
      amountFormatted: formatINR(payment.amount),
      currency: payment.currency,
      status: payment.status,
      gateway: payment.gateway,
      razorpayKeyId,
    };
  }

  /**
   * Initiate a payment order using the unified payment core.
   */
  async createPaymentOrder(
    { orgId, userId, referenceId, referenceType, amount, currency = 'INR', gateway = null, idempotencyKey = null },
    session = null
  ) {
    if (!orgId || !userId || !referenceId || !amount) {
      throw new HttpError(400, 'orgId, userId, referenceId, and amount are required.');
    }

    let paymentContext;
    if (referenceType === 'Invoice') {
      const invoiceService = (await import('../invoice/invoice.services.js')).default;
      const invoice = await invoiceService.getInvoiceById(referenceId, session);
      const PaymentContextFactory = (await import('./paymentContext.factory.js')).default;
      paymentContext = PaymentContextFactory.fromInvoice(invoice, {
        amount: Number(amount),
        userId,
        orgId,
        paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
        idempotencyKey,
      });
    } else if (referenceType === 'AmenityReservationHold') {
      const AmenityReservationHold = (await import('../amenityManagement/holds/amenityReservationHold.model.js')).default;
      const holdQuery = AmenityReservationHold.findById(referenceId);
      if (session) holdQuery.session(session);
      const hold = await holdQuery;
      if (!hold) {
        throw new HttpError(404, 'Referenced reservation hold not found.');
      }
      const PaymentContextFactory = (await import('./paymentContext.factory.js')).default;
      paymentContext = PaymentContextFactory.fromAmenityReservationHold(hold, {
        amount: Number(amount),
        userId,
        orgId,
        paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
        idempotencyKey,
      });
    } else if (referenceType === 'AmenityBooking' || referenceType === 'Amenity') {
      const AmenityBooking = (await import('../amenityBooking/amenityBooking.model.js')).default;
      const bookingQuery = AmenityBooking.findById(referenceId);
      if (session) bookingQuery.session(session);
      const booking = await bookingQuery;
      if (!booking) {
        throw new HttpError(404, 'Referenced amenity booking not found.');
      }
      const PaymentContextFactory = (await import('./paymentContext.factory.js')).default;
      paymentContext = PaymentContextFactory.fromAmenityBooking(booking, {
        amount: Number(amount),
        userId,
        orgId,
        paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
        idempotencyKey,
      });
    } else {
      const domain = resolvePaymentDomain({ referenceType });
      paymentContext = new PaymentContext({
        domain,
        referenceId: String(referenceId),
        referenceType: referenceType || 'Invoice',
        orgId: String(orgId),
        userId: String(userId),
        amount: Number(amount),
        currency: currency || 'INR',
        paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
        idempotencyKey,
      });
    }

    return await unifiedPaymentService.createPaymentOrder(paymentContext, {
      gateway,
      session,
    });
  }

  /**
   * Verify payment signature and mark payment as success or failed.
   */
  async verifyPaymentSignature({ orgId, paymentId, orderId, razorpayPaymentId, razorpaySignature }) {
    return await unifiedPaymentService.verifyPayment({
      orgId,
      paymentId,
      orderId,
      razorpayPaymentId,
      razorpaySignature,
    });
  }

  async assertPaymentAccess(paymentId, { orgId, userId, isAdmin = false } = {}) {
    const payment = await Payment.findById(paymentId);
    if (!payment || (orgId && String(payment.orgId) !== String(orgId))) {
      throw new HttpError(404, 'Payment record not found.');
    }
    if (!isAdmin && userId && String(payment.userId) !== String(userId)) {
      throw new HttpError(403, 'Forbidden. This payment belongs to another user.');
    }
    return payment;
  }

  /**
   * Process refund via unified payment core.
   */
  async processRefund(paymentId, amount = null, notes = {}, context = {}) {
    return await unifiedPaymentService.processRefund({
      paymentId,
      amount,
      notes,
    });
  }

  /**
   * Get payment status via unified payment core.
   */
  async getPaymentStatus(paymentId) {
    return await unifiedPaymentService.getPaymentStatus(paymentId);
  }

  /**
   * Check if payment gateway is configured for an organization.
   */
  async isGatewayConfigured(orgId, provider = 'razorpay') {
    return await paymentConfigResolver.isConfigured({ orgId, provider });
  }

  /**
   * Legacy / Mock Callback Simulation
   */
  async simulatePaymentCallback(paymentId, isSuccess, errorReason = null, paymentMethod = 'wallet') {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) throw new HttpError(404, 'Payment not found');

      if (payment.status !== 'pending' && payment.status !== 'processing') {
        throw new HttpError(400, `Payment already processed with status: ${payment.status}`);
      }

      payment.status = isSuccess ? 'success' : 'failed';
      payment.gatewayTransactionId = `txn_${uuidv4()}`;
      payment.paymentMethod = paymentMethod;
      if (!isSuccess) {
        payment.errorReason = errorReason || 'Payment declined by mock bank';
      }

      await payment.save();

      if (isSuccess) {
        paymentEventEmitter.emit(PAYMENT_SUCCESS, payment);
      } else {
        paymentEventEmitter.emit(PAYMENT_FAILED, payment);
      }

      return payment;
    } catch (error) {
      logger.error('Error simulating payment callback', { error: error.message });
      throw error;
    }
  }

  /**
   * Dashboard aggregation methods
   */
  async getPaymentStats(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return await paymentRepository.getPaymentStats(orgId);
  }

  async getRevenueTrend(orgId) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return await paymentRepository.getRevenueTrend(orgId);
  }

  async getRecentActivity(orgId, limit = 10) {
    if (!orgId) throw new HttpError(400, 'Organization ID is required');
    return await paymentRepository.getRecentActivity(orgId, limit);
  }

  /**
   * Record payment entry transactionally
   */
  async recordPayment(data, session = null) {
    return await paymentRepository.createPayment(data, session);
  }

  /**
   * Generate Razorpay Payment Link
   */
  /**
   * Razorpay client for the invoice's community (Integration Hub credentials, then ENV).
   * Returns null when no credentials exist (local/dev).
   */
  async _getRazorpayInstance(orgId) {
    let credentials = {};
    try {
      credentials = await integrationHubService.getDecryptedCredentials(orgId, 'razorpay');
    } catch (err) {
      logger.warn('Failed to get credentials from integrationHub, falling back to ENV', { error: err.message });
    }
    const key_id = credentials.key_id || process.env.RAZORPAY_KEY_ID;
    const key_secret = credentials.key_secret || process.env.RAZORPAY_KEY_SECRET;
    return key_id && key_secret ? new Razorpay({ key_id, key_secret }) : null;
  }

  /**
   * Creates a Razorpay Payment Link for `amount` (the invoice's CURRENT outstanding).
   * Razorpay's own email/SMS is off: the community's email (our template) carries the link.
   * `attempt` keeps reference_id unique across regenerations (Razorpay requires uniqueness).
   * @returns {Promise<{ id: string|null, url: string, amount: number, expiresAt: Date|null }>}
   */
  async createPaymentLink(invoice, user, { amount, attempt = 0 } = {}) {
    const payAmount = Number(amount ?? invoice.outstandingAmount ?? invoice.totalDue);
    try {
      const instance = await this._getRazorpayInstance(invoice.orgId);
      if (!instance) {
        logger.warn('Razorpay credentials not found, returning mock payment link for testing');
        return { id: null, url: `https://rzp.io/mock_link/${invoice._id}`, amount: payAmount, expiresAt: null };
      }

      const expireBy = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
      const payload = {
        amount: Math.round(payAmount * 100), // minor units
        currency: invoice.currency || 'INR',
        reference_id: attempt ? `${invoice._id}-${attempt}` : invoice._id.toString(),
        description: `Payment for Invoice ${invoice.invoiceNumber || invoice._id}`,
        customer: {
          name: user.name || user.username || 'Resident',
          contact: user.phone || '',
          email: user.email || '',
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        expire_by: expireBy,
        notes: {
          invoiceId: invoice._id.toString(),
          orgId: invoice.orgId.toString(),
          userId: user._id.toString(),
        },
      };

      const link = await instance.paymentLink.create(payload);
      return { id: link.id, url: link.short_url, amount: payAmount, expiresAt: new Date(expireBy * 1000) };
    } catch (error) {
      logger.error('Failed to create Razorpay payment link:', error);
      throw new HttpError(500, `Payment Link generation failed: ${error.message || error?.error?.description}`);
    }
  }

  /** Best-effort cancel; a link that is already paid/expired/cancelled is not an error. */
  async cancelPaymentLink(orgId, paymentLinkId) {
    if (!paymentLinkId) return false;
    try {
      const instance = await this._getRazorpayInstance(orgId);
      if (!instance) return false;
      await instance.paymentLink.cancel(paymentLinkId);
      return true;
    } catch (error) {
      logger.warn('Razorpay payment link cancel skipped', { paymentLinkId, reason: error?.error?.description || error.message });
      return false;
    }
  }

  /**
   * List payments with advanced multi-criteria filtering and server-side aggregation pagination.
   */
  async getPayments(filters = {}, options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.max(1, parseInt(options.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const matchStage = {};

    if (filters.orgId) {
      matchStage.orgId = new mongoose.Types.ObjectId(filters.orgId);
    }
    if (filters.userId) {
      matchStage.userId = new mongoose.Types.ObjectId(filters.userId);
    }
    if (filters.status) {
      matchStage.status = filters.status;
    }
    if (filters.paymentCategory) {
      matchStage.paymentCategory = filters.paymentCategory;
    }
    if (filters.paymentMethod) {
      matchStage.paymentMethod = filters.paymentMethod;
    }
    if (filters.approvalStatus) {
      matchStage.approvalStatus = filters.approvalStatus;
    }
    if (filters.referenceType) {
      matchStage.referenceType = filters.referenceType;
    }
    if (filters.referenceId) {
      matchStage.referenceId = filters.referenceId;
    }
    if (filters.startDate || filters.endDate) {
      matchStage.paymentDate = {};
      if (filters.startDate) matchStage.paymentDate.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.paymentDate.$lte = new Date(filters.endDate);
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      matchStage.amount = {};
      if (filters.minAmount !== undefined) matchStage.amount.$gte = Number(filters.minAmount);
      if (filters.maxAmount !== undefined) matchStage.amount.$lte = Number(filters.maxAmount);
    }
    matchStage.isDeleted = false;

    const sortStage = {};
    if (options.sortBy) {
      sortStage[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
    } else {
      sortStage.createdAt = -1;
    }

    const aggregationPipeline = [
      { $match: matchStage },
      { $sort: sortStage },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const results = await Payment.aggregate(aggregationPipeline);
    const totalRecords = results[0]?.metadata[0]?.total || 0;
    const records = results[0]?.data || [];

    return {
      payments: records,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }
}

export const paymentService = new PaymentService();
export default paymentService;
