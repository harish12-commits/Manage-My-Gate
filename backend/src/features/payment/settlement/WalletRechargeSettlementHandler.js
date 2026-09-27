import DomainSettlementInterface from './DomainSettlementInterface.js';
import logger from '../../../utils/logger.utils.js';

export class WalletRechargeSettlementHandler extends DomainSettlementInterface {
  async settle(payment, session) {
    logger.info('Executing Wallet Recharge settlement', {
      userId: payment.userId,
      paymentId: payment._id,
      amount: payment.amount,
    });

    const walletService = (await import('../../wallet/wallet.service.js')).default;

    const settledTransaction = await walletService.handleWebhookRecharge(
      payment,
      payment.gatewayTransactionId,
      session
    );

    return settledTransaction;
  }

  async refund(payment, refundRecord, session) {
    logger.info('Executing Wallet Recharge refund settlement', {
      userId: payment.userId,
      refundId: refundRecord._id,
      amount: refundRecord.amount,
    });

    // Cross-feature access goes through the wallet service (never the wallet repository).
    // debitWallet is atomic and rejects the reversal if the recharged money has already been spent.
    const walletService = (await import('../../wallet/wallet.service.js')).default;
    const { wallet, transaction } = await walletService.debitWallet({
      userId: payment.userId,
      orgId: payment.orgId,
      amount: Math.abs(Number(refundRecord.amount)),
      referenceType: 'Refund',
      referenceId: refundRecord._id,
      paymentId: payment._id,
      idempotencyKey: `RECHARGE-REFUND-${refundRecord._id.toString()}`,
      description: `Wallet recharge refund reversal (Payment: ${payment.gatewayTransactionId || payment._id})`,
      // settleRefund posts the refund ledger entry itself
      skipLedger: true,
      session,
    });

    return { wallet, transaction };
  }
}

export default new WalletRechargeSettlementHandler();
