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
  async createPaymentLink(invoice, user) {
    try {
      const activeGateway = 'razorpay';
      let credentials = {};
      try {
        credentials = await integrationHubService.getDecryptedCredentials(invoice.orgId, activeGateway);
      } catch (err) {
        logger.warn('Failed to get credentials from integrationHub, falling back to ENV', { error: err.message });
      }

      const key_id = credentials.key_id || process.env.RAZORPAY_KEY_ID;
      const key_secret = credentials.key_secret || process.env.RAZORPAY_KEY_SECRET;

      if (!key_id || !key_secret) {
        logger.warn('Razorpay credentials not found, returning mock payment link for testing');
        return `https://rzp.io/mock_link/${invoice._id}`;
      }

      const instance = new Razorpay({ key_id, key_secret });

      const payload = {
        amount: Math.round(invoice.totalDue * 100), // paise
        currency: 'INR',
        reference_id: invoice._id.toString(),
        description: `Payment for Invoice ${invoice.invoiceNumber || invoice._id}`,
        customer: {
          name: user.name || user.username || 'Resident',
          contact: user.phone || '',
          email: user.email || '',
        },
        notify: {
          sms: false,
          email: true,
        },
        reminder_enable: true,
        notes: {
          invoiceId: invoice._id.toString(),
          orgId: invoice.orgId.toString(),
          userId: user._id.toString(),
        },
      };

      const link = await instance.paymentLink.create(payload);

      return link.short_url;
    } catch (error) {
      logger.error('Failed to create Razorpay payment link:', error);
      throw new HttpError(500, `Payment Link generation failed: ${error.message}`);
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
