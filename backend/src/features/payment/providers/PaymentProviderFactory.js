import razorpayProvider from './razorpay.provider.js';
import mockProvider from './mock.provider.js';
import PaymentProviderInterface from './PaymentProviderInterface.js';
import logger from '../../../utils/logger.utils.js';
import HttpError from '../../../utils/httpError.utils.js';

/**
 * Payment Provider Factory
 * Manages registry and resolution of payment gateway providers (Razorpay, Mock, and future integrations).
 */
export class PaymentProviderFactory {
  constructor() {
    this._providers = new Map();
    
    // Register built-in default providers
    this.registerProvider('razorpay', razorpayProvider);
    this.registerProvider('mock', mockProvider);
  }

  /**
   * Register a provider instance.
   * @param {string} name - Identifier for the provider (case-insensitive)
   * @param {PaymentProviderInterface|object} providerInstance - Strategy instance
   */
  registerProvider(name, providerInstance) {
    if (!name || typeof name !== 'string') {
      throw new HttpError(500, 'Provider name must be a non-empty string.');
    }
    if (!providerInstance || typeof providerInstance !== 'object') {
      throw new HttpError(500, `Invalid provider instance for '${name}'.`);
    }

    // Verify required interface contracts
    const requiredMethods = ['createOrder', 'verifySignature', 'refund'];
    for (const method of requiredMethods) {
      if (typeof providerInstance[method] !== 'function') {
        throw new HttpError(
          500,
          `Provider '${name}' must implement contract method '${method}()'.`
        );
      }
    }

    this._providers.set(name.toLowerCase(), providerInstance);
    logger.debug(`Registered payment provider '${name.toLowerCase()}'.`);
  }

  /**
   * Check whether a provider strategy is registered.
   * @param {string} name
   * @returns {boolean}
   */
  supportsProvider(name) {
    if (!name || typeof name !== 'string') return false;
    return this._providers.has(name.toLowerCase());
  }

  /**
   * List all currently registered provider names.
   * @returns {string[]}
   */
  listSupportedProviders() {
    return Array.from(this._providers.keys());
  }

  /**
   * Retrieve a payment provider instance by name.
   * @param {string} [providerName] - e.g. 'razorpay', 'mock'
   * @param {object} [options={}] - Options e.g. { fallbackToMock: true }
   * @returns {PaymentProviderInterface}
   */
  getProvider(providerName, options = { fallbackToMock: true }) {
    const selected = (providerName || process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();

    if (this._providers.has(selected)) {
      return this._providers.get(selected);
    }

    if (options.fallbackToMock) {
      logger.warn(
        `Unknown payment provider '${selected}'. Falling back to mock provider. Supported providers: ${this.listSupportedProviders().join(', ')}`
      );
      return this._providers.get('mock');
    }

    throw new HttpError(400, `Unsupported payment provider '${selected}'.`);
  }
}

// Global Singleton Instance
export const paymentProviderFactory = new PaymentProviderFactory();

export default paymentProviderFactory;
