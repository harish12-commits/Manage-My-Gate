import razorpayProvider from './razorpay.provider.js';
import mockProvider from './mock.provider.js';
import PaymentProviderInterface from './PaymentProviderInterface.js';
import { PaymentProviderFactory, paymentProviderFactory } from './PaymentProviderFactory.js';
import logger from '../../../utils/logger.utils.js';

/**
 * Payment Provider Factory Function (Backward Compatible)
 * Dynamically selects and returns the active payment provider strategy.
 * @param {string} [providerName] - Name of provider ('razorpay', 'mock')
 * @returns {import('./PaymentProviderInterface.js').default} Payment Provider Strategy Instance
 */
export function getPaymentProvider(providerName) {
  return paymentProviderFactory.getProvider(providerName);
}

export {
  PaymentProviderInterface,
  PaymentProviderFactory,
  paymentProviderFactory,
  razorpayProvider,
  mockProvider,
};

export default {
  getPaymentProvider,
  PaymentProviderFactory,
  paymentProviderFactory,
  razorpayProvider,
  mockProvider,
};
