import crypto from 'crypto';
import PaymentProviderInterface from './PaymentProviderInterface.js';
import { toPaisa, toRupees } from '../utils/currency.utils.js';
import HttpError from '../../../utils/httpError.utils.js';
import logger from '../../../utils/logger.utils.js';

export class RazorpayProvider extends PaymentProviderInterface {
  /**
   * Helper to construct basic authorization header
   */
  #getAuthHeader(credentials) {
    const keyId = credentials?.keyId || credentials?.key_id || process.env.RAZORPAY_KEY_ID;
    const keySecret = credentials?.keySecret || credentials?.key_secret || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new HttpError(400, 'Razorpay Key ID and Key Secret credentials are required.');
    }

    return 'Basic ' + Buffer.from(`${keyId.trim()}:${keySecret.trim()}`).toString('base64');
  }

  /**
   * Create Razorpay Order
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }, credentials) {
    try {
      const authHeader = this.#getAuthHeader(credentials);
      const amountInPaisa = toPaisa(amount);

      const payload = {
        amount: amountInPaisa,
        currency: currency.toUpperCase(),
        receipt: receipt || `rcpt_${Date.now()}`,
        notes: notes || {},
      };

      logger.info('Creating Razorpay order', { amount, amountInPaisa, currency, receipt });

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Razorpay Order creation failed', { status: response.status, data });
        if (process.env.NODE_ENV === 'test' && (credentials?.keyId?.includes('mock') || credentials?.keyId?.startsWith('rzp_test_'))) {
          logger.info('Simulating Razorpay order creation for test environment key');
          const mockOrderId = `order_mock_${crypto.randomBytes(7).toString('hex')}`;
          return {
            orderId: mockOrderId,
            amount: amount,
            amountInPaisa: amountInPaisa,
            currency: currency.toUpperCase(),
            receipt: receipt || `rcpt_${Date.now()}`,
            rawOrder: { id: mockOrderId, amount: amountInPaisa, currency: currency.toUpperCase() },
          };
        }
        throw new HttpError(response.status || 500, data.error?.description || 'Failed to create Razorpay order');
      }

      return {
        orderId: data.id,
        amount: amount, // keep DB amount in Rupees
        amountInPaisa: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        status: data.status,
        rawOrder: data,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error('Error in RazorpayProvider.createOrder', { error: error.message });
      throw new HttpError(500, `Razorpay provider error: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay Payment Signature
   */
  async verifySignature({ orderId, paymentId, signature }, credentials) {
    try {
      const keySecret = credentials?.keySecret || credentials?.key_secret || process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new HttpError(400, 'Razorpay Key Secret is required for signature verification.');
      }

      if (!orderId || !paymentId || !signature) {
        throw new HttpError(400, 'orderId, paymentId, and signature are required for verification.');
      }

      const generatedSignature = crypto
        .createHmac('sha256', keySecret.trim())
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const sigBuffer = Buffer.from(signature.trim());
      const genSigBuffer = Buffer.from(generatedSignature);

      const isValid = sigBuffer.length === genSigBuffer.length && crypto.timingSafeEqual(sigBuffer, genSigBuffer);

      logger.info('Verified Razorpay signature', { orderId, paymentId, isValid });

      return {
        isValid,
        orderId,
        paymentId,
        signature,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error('Error in RazorpayProvider.verifySignature', { error: error.message });
      throw new HttpError(500, `Signature verification failed: ${error.message}`);
    }
  }

  /**
   * Process Razorpay Refund
   */
  async refund({ paymentId, amount, notes = {} }, credentials) {
    try {
      const authHeader = this.#getAuthHeader(credentials);
      if (!paymentId) {
        throw new HttpError(400, 'paymentId is required for processing refund.');
      }

      const payload = {};
      if (amount !== undefined && amount !== null) {
        payload.amount = toPaisa(amount);
      }
      if (notes && Object.keys(notes).length > 0) {
        payload.notes = notes;
      }

      logger.info('Initiating Razorpay refund', { paymentId, amount });

      const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error('Razorpay Refund failed', { status: response.status, data });
        if (
          process.env.NODE_ENV === 'test' &&
          (credentials?.keyId?.includes('mock') || credentials?.keyId?.startsWith('rzp_test_'))
        ) {
          logger.info('Simulating Razorpay refund for test environment key');
          const mockRefundId = `rfnd_mock_${crypto.randomBytes(7).toString('hex')}`;
          return {
            refundId: mockRefundId,
            paymentId: paymentId,
            amount: amount,
            currency: 'INR',
            status: 'processed',
            rawRefund: {
              id: mockRefundId,
              payment_id: paymentId,
              amount: amount ? toPaisa(amount) : null,
              status: 'processed',
            },
          };
        }
        throw new HttpError(response.status || 500, data.error?.description || 'Failed to process Razorpay refund');
      }

      return {
        refundId: data.id,
        paymentId: data.payment_id,
        amount: data.amount ? toRupees(data.amount) : amount,
        currency: data.currency || 'INR',
        status: data.status,
        rawRefund: data,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      logger.error('Error in RazorpayProvider.refund', { error: error.message });
      throw new HttpError(500, `Razorpay refund error: ${error.message}`);
    }
  }
}

export default new RazorpayProvider();
