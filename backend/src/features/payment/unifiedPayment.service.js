import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Payment from './payment.model.js';
import paymentRepository from './payment.repository.js';
import paymentSettlementService from './paymentSettlement.service.js';
import paymentProviderFactory from './providers/PaymentProviderFactory.js';
import paymentConfigResolver from './paymentConfig.resolver.js';
import { assertValidPaymentContext } from './payment.types.js';
import {
  PAYMENT_DOMAINS,
  toCanonicalPaymentStatus,
  formatINR,
} from './payment.constants.js';
import {
  resolvePaymentDomain,
  validateAuthoritativeAmount,
} from './payment.utils.js';
import {
  paymentEventEmitter,
  PAYMENT_INITIATED,
  PAYMENT_FAILED,
} from './payment.events.js';
import HttpError from '../../utils/httpError.utils.js';
import logger from '../../utils/logger.utils.js';

/**
 * Validates HMAC SHA256 webhook signature safely.
 * @param {Buffer|string} rawBody
 * @param {string} signature
 * @param {string} secret
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');
    const expectedSignature = crypto
      .createHmac('sha256', secret.trim())
      .update(rawBuffer)
      .digest('hex');

    const sigBuffer = Buffer.from(signature.trim());
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    logger.error('Error in verifyWebhookSignature', { error: err.message });
    return false;
  }
}

/**
 * Unified Payment Core Service
 * Authoritative orchestration layer for resident gateway payment workflows
 * (Billing Invoices, Amenity Bookings, and Digital Wallet Recharges).
 */
export class UnifiedPaymentService {
  /**
   * 1. Create a Payment Order with gateway provider.
   * @param {import('./payment.types.js').PaymentContext|object} paymentContext
   * @param {object} [options={}]
   * @returns {Promise<object>} Normalized payment order response
   */
  async createPaymentOrder(paymentContext, options = {}) {
    logger.info('payment.order.creation.started', {
      domain: paymentContext.domain,
      referenceId: paymentContext.referenceId,
      amount: paymentContext.amount,
      orgId: paymentContext.orgId,
    });

    // 1. Assert PaymentContext contract
    assertValidPaymentContext(paymentContext);

    const orgId = String(paymentContext.orgId);
    const userId = String(paymentContext.userId);
    const referenceId = String(paymentContext.referenceId);
    const referenceType = paymentContext.referenceType;
    const amount = Number(paymentContext.amount);
    const currency = (paymentContext.currency || 'INR').toUpperCase();
    const activeGateway = (options.gateway || 'razorpay').toLowerCase();

    // 2. Authoritative Domain Amount & State Validation
    await validateAuthoritativeAmount(
      paymentContext.domain,
      referenceId,
      amount,
      options.session,
      { orgId, userId }
    );

    // 3. Prevent duplicate active orders within a 5-minute window
    const recentActiveOrder = await Payment.findOne({
      referenceId,
      referenceType,
      status: 'pending',
      amount,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });

    if (recentActiveOrder && recentActiveOrder.gatewayOrderId) {
      logger.info('payment.order.reused', {
        paymentId: recentActiveOrder._id,
        orderId: recentActiveOrder.gatewayOrderId,
        referenceId,
      });

      const config = await paymentConfigResolver.getConfig({ orgId, provider: activeGateway });

      return {
        success: true,
        reused: true,
        paymentId: recentActiveOrder._id,
        orderId: recentActiveOrder.gatewayOrderId,
        amount: recentActiveOrder.amount,
        amountFormatted: formatINR(recentActiveOrder.amount),
        currency: recentActiveOrder.currency,
        status: recentActiveOrder.status,
        gateway: recentActiveOrder.gateway,
        razorpayKeyId: config.keyId,
      };
    }

    // 4. Resolve Gateway Provider Strategy
    const provider = paymentProviderFactory.getProvider(activeGateway);

    // 5. Resolve Tenant Credentials
    const config = await paymentConfigResolver.getConfig({ orgId, provider: activeGateway });

    if (activeGateway === 'razorpay') {
      if (!config.isConfigured || !paymentConfigResolver.validateConfig(config)) {
        throw new HttpError(
          400,
          'Online payment gateway (Razorpay) has not been configured for your community by the administrator. Please contact your community admin or use an offline payment method.'
        );
      }
    } else if (activeGateway === 'mock') {
      if (process.env.NODE_ENV === 'production') {
        throw new HttpError(400, 'Mock payment gateway is disabled in this environment.');
      }
    }

    // 6. Create Order with Payment Gateway
    const receipt = `rcpt_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    let orderPayload;
    try {
      orderPayload = await provider.createOrder(
        {
          amount,
          currency,
          receipt,
          notes: {
            orgId,
            userId,
            referenceId,
            referenceType,
            domain: paymentContext.domain,
            idempotencyKey: paymentContext.idempotencyKey,
          },
        },
        config
      );
    } catch (err) {
      logger.error('payment.order.gateway_error', { gateway: activeGateway, error: err.message });
      const statusCode = err.statusCode === 401 ? 400 : err.statusCode || 500;
      throw new HttpError(statusCode, `Payment gateway error: ${err.message}`);
    }

    // 7. Persist Canonical Payment Record (Status = PENDING)
    const payment = new Payment({
      orgId,
      userId,
      residentId: userId,
      invoiceId: referenceType === 'Invoice' ? referenceId : null,
      referenceId,
      referenceType,
      domain: paymentContext.domain,
      amount,
      currency,
      status: 'pending',
      gateway: activeGateway,
      gatewayOrderId: orderPayload.orderId,
      gatewayTransactionId: orderPayload.orderId,
      paymentMethod: paymentContext.paymentMethod || 'credit_card',
      idempotencyKey: paymentContext.idempotencyKey,
      metadata: {
        ...(paymentContext.metadata || {}),
        receipt,
      },
    });

    await payment.save(options.session ? { session: options.session } : undefined);

    logger.info('payment.created', {
      paymentId: payment._id,
      orderId: orderPayload.orderId,
      domain: payment.domain,
      amount: payment.amount,
    });

    // 8. Emit Payment Initiated Event
    paymentEventEmitter.emit(PAYMENT_INITIATED, payment);

    return {
      success: true,
      paymentId: payment._id,
      orderId: orderPayload.orderId,
      amount: payment.amount,
      amountFormatted: formatINR(payment.amount),
      currency: payment.currency,
      status: payment.status,
      gateway: payment.gateway,
      razorpayKeyId: config.keyId,
      rawOrder: orderPayload.rawOrder,
    };
  }

  /**
   * 2. Authoritatively verify gateway signature and execute atomic domain settlement.
   * @param {object} params
   * @param {string} params.paymentId - Payment record ID
   * @param {string} [params.orderId] - Gateway order ID
   * @param {string} params.razorpayPaymentId - Gateway payment ID
   * @param {string} params.razorpaySignature - Signature from gateway
   * @param {string} [params.orgId] - Organization ID
   * @returns {Promise<object>} Verification and settlement result
   */
  async verifyPayment({
    paymentId,
    orderId,
    razorpayPaymentId,
    razorpaySignature,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orgId,
  }) {
    const effectiveOrderId = orderId || razorpay_order_id;
    const effectivePaymentId = razorpayPaymentId || razorpay_payment_id;
    const effectiveSignature = razorpaySignature || razorpay_signature;

    logger.info('payment.verification.started', {
      paymentId,
      orderId: effectiveOrderId,
      razorpayPaymentId: effectivePaymentId,
    });

    if (!paymentId && !effectiveOrderId) {
      throw new HttpError(400, 'paymentId or orderId is required for payment verification.');
    }

    // 1. Locate Payment Record
    const query = paymentId
      ? Payment.findById(paymentId)
      : Payment.findOne({ $or: [{ gatewayOrderId: effectiveOrderId }, { gatewayTransactionId: effectiveOrderId }] });

    const payment = await query;
    if (!payment) {
      throw new HttpError(404, 'Payment record not found.');
    }

    // 2. Idempotency Check: Already settled
    if (payment.status === 'success') {
      logger.info('payment.verification.already_settled', { paymentId: payment._id });
      return {
        success: true,
        message: 'Payment already verified and settled',
        payment,
        alreadySettled: true,
      };
    }

    const effectiveOrgId = orgId || payment.orgId;
    const activeGateway = payment.gateway || 'mock';

    // 3. Resolve Provider & Credentials
    const provider = paymentProviderFactory.getProvider(activeGateway);
    const config = await paymentConfigResolver.getConfig({
      orgId: effectiveOrgId,
      provider: activeGateway,
    });

    // 4. Verify Signature
    let verification;
    if (
      process.env.NODE_ENV !== 'production' &&
      (effectiveSignature?.startsWith('sig_mock_') || activeGateway === 'mock')
    ) {
      logger.info('Bypassing signature verification for mock/test signature in non-production');
      verification = { isValid: true };
    } else {
      verification = await provider.verifySignature(
        {
          orderId: effectiveOrderId || payment.gatewayOrderId || payment.gatewayTransactionId,
          paymentId: effectivePaymentId,
          signature: effectiveSignature,
        },
        config
      );
    }

    // 5. Handle Verification Failure
    if (!verification.isValid) {
      payment.status = 'failed';
      payment.errorReason = 'Invalid payment gateway signature';
      await payment.save();

      paymentEventEmitter.emit(PAYMENT_FAILED, payment);
      logger.warn('payment.verification.failed', { paymentId: payment._id, orderId });

      throw new HttpError(400, 'Invalid payment gateway signature.');
    }

    logger.info('payment.verification.success', { paymentId: payment._id, razorpayPaymentId });

    // 6. Execute Atomic Transactional Domain Settlement
    const settlementResult = await paymentSettlementService.settlePayment({
      paymentId: payment._id,
      gatewayTransactionId: razorpayPaymentId,
      gatewayOrderId: orderId || payment.gatewayOrderId,
      paymentMethod: 'RAZORPAY',
    });

    return {
      success: true,
      message: 'Payment verified and settled successfully',
      payment: settlementResult.payment,
      domainResult: settlementResult.domainResult,
      invoice: settlementResult.domainResult,
      settlement: settlementResult,
      ledgerEntry: settlementResult.ledgerEntry,
    };
  }

  /**
   * 3. Authoritative Resident Webhook Ingress
   * Handles raw webhook payloads with tenant-aware credential resolution, signature verification,
   * database idempotency, and atomic settlement.
   * @param {Buffer|string|object} rawBody - Raw body payload
   * @param {string} signature - x-razorpay-signature header value
   * @param {object} [headers={}] - Request headers
   * @returns {Promise<object>} Processing outcome
   */
  async processWebhook(rawBody, signature, headers = {}) {
    logger.info('payment.webhook.received', { signaturePreview: signature ? signature.substring(0, 10) + '...' : null });

    // Parse event payload safely
    let eventPayload;
    if (Buffer.isBuffer(rawBody)) {
      eventPayload = JSON.parse(rawBody.toString('utf8'));
    } else if (typeof rawBody === 'string') {
      eventPayload = JSON.parse(rawBody);
    } else {
      eventPayload = rawBody;
    }

    const { event, payload } = eventPayload;
    const paymentEntity = payload?.payment?.entity || payload?.order?.entity || {};
    const razorpayPaymentId = paymentEntity.id || payload?.payment?.entity?.id;
    const orderId = paymentEntity.order_id || paymentEntity.id;
    const notes = paymentEntity.notes || {};
    const eventId = eventPayload.id || `evt_${orderId || razorpayPaymentId}_${Date.now()}`;

    // 1. Authoritative Payment Lookup by gateway order or transaction ID
    let payment = null;
    if (orderId) {
      payment = await Payment.findOne({
        $or: [{ gatewayOrderId: orderId }, { gatewayTransactionId: orderId }],
      });
    }

    if (!payment && notes.referenceId && notes.domain) {
      payment = await Payment.findOne({
        referenceId: notes.referenceId,
        domain: notes.domain,
        status: 'pending',
      }).sort({ createdAt: -1 });
    }

    // 2. Tenant-Aware Credential Resolution for Signature Verification
    let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (payment && payment.orgId) {
      const config = await paymentConfigResolver.getConfig({
        orgId: payment.orgId,
        provider: 'razorpay',
      });
      if (config.webhookSecret) {
        webhookSecret = config.webhookSecret;
      } else if (config.keySecret) {
        webhookSecret = config.keySecret;
      }
    }

    if (!webhookSecret) {
      webhookSecret = 'default_webhook_secret_key';
    }

    // 3. Verify Signature
    if (signature && process.env.NODE_ENV !== 'test') {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.warn('payment.webhook.signature_failed', { orderId, razorpayPaymentId });
        throw new HttpError(400, 'Invalid webhook signature');
      }
    }

    // 4. Handle Webhook Events
    if (event === 'payment.captured' || event === 'order.paid') {
      if (!payment) {
        logger.info('payment.webhook.unmatched', { orderId, razorpayPaymentId, notes });
        return { success: true, message: 'Webhook received for unmatched entity' };
      }

      // Check Idempotency: Already processed
      if (payment.status === 'success' || payment.processedEvents?.some((e) => e.eventId === eventId)) {
        logger.info('payment.webhook.duplicate', { paymentId: payment._id, eventId });
        return { success: true, message: 'Webhook already processed (idempotent)', paymentId: payment._id };
      }

      // Execute Atomic Settlement
      try {
        const settlement = await paymentSettlementService.settlePayment({
          paymentId: payment._id,
          gatewayTransactionId: razorpayPaymentId,
          gatewayOrderId: orderId,
          gatewayEventId: eventId,
          paymentMethod: paymentEntity.method || 'RAZORPAY',
        });

        return {
          success: true,
          message: 'Webhook processed and payment settled successfully',
          paymentId: settlement.payment._id,
          alreadySettled: settlement.alreadySettled,
        };
      } catch (settleError) {
        if (
          settleError.code === 112 ||
          settleError.code === 11000 ||
          settleError.name === 'VersionError' ||
          settleError.hasErrorLabel?.('TransientTransactionError')
        ) {
          logger.warn('Concurrent webhook write conflict handled idempotently', {
            paymentId: payment._id,
            eventId,
          });
          return {
            success: true,
            message: 'Webhook processed concurrently (idempotent)',
            paymentId: payment._id,
            alreadySettled: true,
          };
        }
        throw settleError;
      }
    }

    if (event === 'payment.failed') {
      if (payment && payment.status !== 'success') {
        payment.status = 'failed';
        payment.errorReason = paymentEntity.error_description || 'Payment failed on gateway';
        await payment.save();
        paymentEventEmitter.emit(PAYMENT_FAILED, payment);
        logger.warn('payment.webhook.payment_failed', { paymentId: payment._id, orderId });
      }
      return { success: true, message: 'Payment failure recorded' };
    }

    logger.info('payment.webhook.ignored_event', { event });
    return { success: true, message: `Event ${event} acknowledged` };
  }

  /**
   * 4. Unified Refund Orchestration
   * @param {object} params
   * @param {string} params.paymentId - Original payment record ID
   * @param {number} [params.amount] - Partial or full refund amount
   * @param {object} [params.notes={}] - Optional notes
   * @returns {Promise<object>} Refund outcome
   */
  async processRefund(param1, param2, param3) {
    let paymentId, amount, notes;
    if (typeof param1 === 'object' && param1 !== null && !param1._bsontype) {
      ({ paymentId, amount = null, notes = {} } = param1);
    } else {
      paymentId = param1;
      amount = param2 !== undefined ? param2 : null;
      notes = typeof param3 === 'string' ? { reason: param3 } : (param3 || {});
    }

    logger.info('payment.refund.started', { paymentId, amount });

    if (!paymentId) {
      throw new HttpError(400, 'paymentId is required for refund.');
    }

    const originalPayment = await Payment.findById(paymentId);
    if (!originalPayment) {
      throw new HttpError(404, 'Original payment record not found.');
    }

    if (originalPayment.status !== 'success') {
      throw new HttpError(400, 'Only successful payments can be refunded.');
    }

    const refundAmount = amount ? Number(amount) : originalPayment.amount;
    if (refundAmount <= 0 || refundAmount > originalPayment.amount) {
      throw new HttpError(400, `Refund amount ₹${refundAmount} is invalid or exceeds original payment of ₹${originalPayment.amount}.`);
    }

    // Verify existing refunds don't exceed original payment
    const existingRefunds = await Payment.find({
      parentPaymentId: originalPayment._id,
      type: 'Refund',
      status: 'success',
    });
    const totalRefunded = existingRefunds.reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);

    if (totalRefunded + refundAmount > originalPayment.amount + 0.01) {
      throw new HttpError(
        400,
        `Total refund requested (₹${totalRefunded + refundAmount}) exceeds original payment of ₹${originalPayment.amount}.`
      );
    }

    const activeGateway = originalPayment.gateway || 'mock';
    const provider = paymentProviderFactory.getProvider(activeGateway);
    const config = await paymentConfigResolver.getConfig({
      orgId: originalPayment.orgId,
      provider: activeGateway,
    });

    let gatewayRefund = { refundId: `rfnd_${uuidv4().replace(/-/g, '').substring(0, 12)}` };

    if (process.env.NODE_ENV !== 'production' && activeGateway === 'mock') {
      logger.info('Simulating gateway refund for mock provider in non-production');
    } else {
      gatewayRefund = await provider.refund(
        {
          paymentId: originalPayment.gatewayTransactionId,
          amount: refundAmount,
          notes,
        },
        config
      );
    }

    // Create Refund Payment record
    const refundRecord = await Payment.create({
      orgId: originalPayment.orgId,
      userId: originalPayment.userId,
      referenceId: originalPayment.referenceId,
      referenceType: originalPayment.referenceType,
      domain: originalPayment.domain || resolvePaymentDomain(originalPayment),
      amount: -Math.abs(refundAmount),
      currency: originalPayment.currency,
      type: 'Refund',
      parentPaymentId: originalPayment._id,
      status: 'success',
      gateway: activeGateway,
      gatewayTransactionId: gatewayRefund.refundId || gatewayRefund.id,
      paymentMethod: originalPayment.paymentMethod,
    });

    // Execute Domain Refund Settlement
    const result = await paymentSettlementService.settleRefund({
      originalPayment,
      refundRecord,
    });

    logger.info('payment.refund.success', {
      originalPaymentId: originalPayment._id,
      refundId: refundRecord._id,
      refundAmount,
    });

    return {
      success: true,
      message: 'Refund processed successfully',
      refund: refundRecord,
      domainResult: result.domainResult,
    };
  }

  /**
   * 5. Get Normalized Payment Status
   * @param {string|object} contextOrId
   * @returns {Promise<object>}
   */
  async getPaymentStatus(contextOrId) {
    const paymentId = typeof contextOrId === 'string' ? contextOrId : contextOrId?.paymentId || contextOrId?.referenceId;
    if (!paymentId) {
      throw new HttpError(400, 'Payment ID is required.');
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new HttpError(404, 'Payment record not found.');
    }

    return {
      paymentId: payment._id,
      status: payment.status,
      canonicalStatus: toCanonicalPaymentStatus(payment.status, payment.domain),
      amount: payment.amount,
      amountFormatted: formatINR(payment.amount),
      currency: payment.currency,
      domain: payment.domain || resolvePaymentDomain(payment),
      referenceId: payment.referenceId,
      referenceType: payment.referenceType,
      gateway: payment.gateway,
      gatewayOrderId: payment.gatewayOrderId,
      gatewayTransactionId: payment.gatewayTransactionId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

export const unifiedPaymentService = new UnifiedPaymentService();
export default unifiedPaymentService;
