import { v4 as uuidv4 } from 'uuid';
import PaymentProviderInterface from './PaymentProviderInterface.js';
import logger from '../../../utils/logger.utils.js';
import HttpError from '../../../utils/httpError.utils.js';
import { assertMockPaymentAllowed } from '../utils/mockGuard.js';

export class MockPaymentProvider extends PaymentProviderInterface {
  /**
   * Create Mock Order
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }, credentials) {
    assertMockPaymentAllowed(HttpError);
    const orderId = `order_mock_${uuidv4().replace(/-/g, '').substring(0, 14)}`;
    logger.info('Creating Mock Payment Order', { orderId, amount, currency });

    return {
      orderId,
      amount,
      currency: currency.toUpperCase(),
      receipt: receipt || `rcpt_mock_${Date.now()}`,
      status: 'created',
      rawOrder: {
        id: orderId,
        entity: 'order',
        amount: amount * 100,
        currency: currency.toUpperCase(),
        status: 'created',
        notes,
      },
    };
  }

  /**
   * Verify Mock Signature
   */
  async verifySignature({ orderId, paymentId, signature }, credentials) {
    assertMockPaymentAllowed(HttpError);
    logger.info('Verifying Mock Payment Signature', { orderId, paymentId });
    // In mock mode, any signature or mock signature is considered valid unless explicitly marked invalid
    const isValid = signature !== 'invalid_mock_signature';
    return {
      isValid,
      orderId,
      paymentId,
      signature,
    };
  }

  async getPaymentStatus({ paymentId, orderId, amount, currency = 'INR' }) {
    assertMockPaymentAllowed(HttpError);
    return {
      paymentId,
      orderId,
      amount,
      amountInPaisa: Number(amount || 0) * 100,
      currency,
      status: 'captured',
      captured: true,
      method: 'mock',
    };
  }

  /**
   * Process Mock Refund
   */
  async refund({ paymentId, amount, notes = {} }, credentials) {
    assertMockPaymentAllowed(HttpError);
    const refundId = `rfnd_mock_${uuidv4().replace(/-/g, '').substring(0, 14)}`;
    logger.info('Processing Mock Refund', { refundId, paymentId, amount });

    return {
      refundId,
      paymentId,
      amount,
      currency: 'INR',
      status: 'processed',
      rawRefund: {
        id: refundId,
        payment_id: paymentId,
        amount: amount ? amount * 100 : null,
        status: 'processed',
        notes,
      },
    };
  }
}

export default new MockPaymentProvider();
