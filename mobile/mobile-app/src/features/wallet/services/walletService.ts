import apiClient from '../../../services/apiClient';
import { getIdempotencyHeaders } from '../../../utils/idempotency';

export const walletService = {
  /**
   * Fetch digital wallet balance, active passes, and transaction statement history.
   * @param params Query parameters for pagination (page, limit)
   */
  async getWalletBalance(params: Record<string, any> = {}): Promise<any> {
    const response: any = await apiClient.get('/wallet', { params });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Create Razorpay payment gateway order to recharge wallet balance.
   * @param amount Numeric recharge amount in INR
   * @param idempotencyKey Deterministic mutation key
   */
  async createWalletOrder(amount: number, idempotencyKey?: string): Promise<any> {
    const headers = getIdempotencyHeaders(idempotencyKey);
    const response: any = await apiClient.post(
      '/wallet/create-order',
      { amount },
      { headers: Object.keys(headers).length > 0 ? headers : undefined }
    );
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Verify Razorpay cryptographic payment signature for wallet top-up.
   * @param paymentData Razorpay order, payment, and signature payload
   * @param idempotencyKey Deterministic verification key
   */
  async verifyWalletPayment(paymentData: any, idempotencyKey?: string): Promise<any> {
    const formattedPayload = {
      ...paymentData,
      paymentId: paymentData?.paymentId || paymentData?.payment_id,
      payment_id: paymentData?.paymentId || paymentData?.payment_id,
      amount: paymentData?.amount,
      razorpay_order_id: paymentData?.razorpay_order_id || paymentData?.razorpayOrderId || paymentData?.orderId,
      razorpay_payment_id: paymentData?.razorpay_payment_id || paymentData?.razorpayPaymentId,
      razorpay_signature: paymentData?.razorpay_signature || paymentData?.razorpaySignature,
      razorpayOrderId: paymentData?.razorpay_order_id || paymentData?.razorpayOrderId || paymentData?.orderId,
      razorpayPaymentId: paymentData?.razorpay_payment_id || paymentData?.razorpayPaymentId,
      razorpaySignature: paymentData?.razorpay_signature || paymentData?.razorpaySignature,
    };
    const headers = getIdempotencyHeaders(idempotencyKey);
    const response: any = await apiClient.post(
      '/wallet/verify-payment',
      formattedPayload,
      { headers: Object.keys(headers).length > 0 ? headers : undefined }
    );
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Direct wallet top-up (test/debug direct add-money).
   * @deprecated Do not use in resident production flows. Top-ups must go through createWalletOrder & verifyWalletPayment.
   * @param amount Numeric recharge amount in INR
   */
  async topUpWalletDirect(amount: number): Promise<any> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Direct wallet mutation is deprecated and disabled in production. Use Razorpay order & verification flows.'
      );
    }
    const response: any = await apiClient.post('/wallet/add-money', { amount });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },

  /**
   * Send available wallet credit back through Razorpay to original payment account.
   */
  async refundWalletToOriginalPayment(paymentId: string, amount: number): Promise<any> {
    const response: any = await apiClient.post('/wallet/refund', { paymentId, amount });
    const body = response?.success !== undefined ? response : response?.data;
    return body?.data || body;
  },
};

export default walletService;
