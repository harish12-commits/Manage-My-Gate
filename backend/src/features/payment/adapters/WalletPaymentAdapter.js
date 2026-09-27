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
 * WalletPaymentAdapter
 * Bridge adapter between the Digital Wallet / WalletTransaction feature and the unified payment layer.
 */
export class WalletPaymentAdapter {
  /**
   * Create a canonical PaymentContext for a wallet recharge.
   * @param {object} rechargeData - { orgId, userId, amount, paymentMethod, referenceId, metadata }
   * @param {object} [options={}]
   * @returns {import('../payment.types.js').PaymentContext}
   */
  createPaymentContext(rechargeData, options = {}) {
    return PaymentContextFactory.fromWalletRecharge(rechargeData, options);
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
      referenceType: paymentContext.referenceType || PAYMENT_REFERENCE_TYPES.WALLET_RECHARGE,
      amount: paymentContext.amount,
      currency: paymentContext.currency,
      gateway: options.gateway || 'razorpay',
    };
  }

  /**
   * Format wallet transaction payload for persistence in WalletTransaction repository.
   * @param {import('../payment.types.js').PaymentContext} paymentContext
   * @param {object} paymentResult - Recorded payment entity or gateway result
   * @returns {object}
   */
  formatWalletTransaction(paymentContext, paymentResult = {}) {
    const rawStatus = paymentResult.status || 'SUCCESS';
    const legacyStatus = toLegacyPaymentStatus(rawStatus, 'WalletTransaction');
    const amount = paymentResult.amount !== undefined ? Number(paymentResult.amount) : paymentContext.amount;
    const transactionId = paymentResult.gatewayTransactionId || paymentResult.orderId || null;

    return {
      walletId: paymentContext.metadata.walletId || null,
      userId: paymentContext.userId,
      amount,
      type: 'credit',
      subType: 'recharge',
      status: legacyStatus,
      paymentMethod: paymentContext.paymentMethod,
      gatewayTransactionId: transactionId,
      description: `Wallet recharge via ${paymentContext.paymentMethod}`,
      metadata: {
        paymentId: paymentResult._id || paymentResult.paymentId || null,
        idempotencyKey: paymentContext.idempotencyKey,
        domain: paymentContext.domain,
        ...paymentContext.metadata,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Convert canonical status to Wallet legacy status.
   * @param {string} canonicalStatus
   * @returns {string}
   */
  toLegacyStatus(canonicalStatus) {
    return toLegacyPaymentStatus(canonicalStatus, 'WalletTransaction');
  }

  /**
   * Convert canonical method to Wallet legacy method.
   * @param {string} canonicalMethod
   * @returns {string}
   */
  toLegacyMethod(canonicalMethod) {
    return toLegacyPaymentMethod(canonicalMethod, 'Wallet');
  }

  /**
   * Convert Wallet status to canonical status.
   * @param {string} walletStatus
   * @returns {string}
   */
  toCanonicalStatus(walletStatus) {
    return toCanonicalPaymentStatus(walletStatus, PAYMENT_DOMAINS.WALLET);
  }

  /**
   * Convert Wallet method to canonical method.
   * @param {string} walletMethod
   * @returns {string}
   */
  toCanonicalMethod(walletMethod) {
    return toCanonicalPaymentMethod(walletMethod);
  }
}

export const walletPaymentAdapter = new WalletPaymentAdapter();
export default walletPaymentAdapter;
