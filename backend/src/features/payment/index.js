/**
 * NAHOM Unified Payment & Financial Foundation
 * Unified Feature Entry Point (Phase 2 & Phase 3)
 */

// 1. Constants & Mapping Utilities
export * from './payment.constants.js';

// 2. Canonical Contracts & Validation
export {
  PaymentContext,
  validatePaymentContext,
  assertValidPaymentContext,
  generateIdempotencyKey,
} from './payment.types.js';

// 3. Payment Context Factory
export {
  PaymentContextFactory,
  default as paymentContextFactory,
} from './paymentContext.factory.js';

// 4. Provider Factory & Gateway Providers
export {
  PaymentProviderInterface,
  PaymentProviderFactory,
  paymentProviderFactory,
  getPaymentProvider,
  razorpayProvider,
  mockProvider,
} from './providers/index.js';

// 5. Unified Configuration Resolver
export {
  PaymentConfigResolver,
  paymentConfigResolver,
  default as paymentConfigResolverDefault,
} from './paymentConfig.resolver.js';

// 6. Domain Adapters
export {
  BillingPaymentAdapter,
  billingPaymentAdapter,
  AmenityPaymentAdapter,
  amenityPaymentAdapter,
  WalletPaymentAdapter,
  walletPaymentAdapter,
} from './adapters/index.js';

// 7. Phase 3: Unified Payment Core & Webhook Ingress
export {
  UnifiedPaymentService,
  unifiedPaymentService,
  verifyWebhookSignature,
} from './unifiedPayment.service.js';

// 8. Phase 3: Atomic Settlement Engine & Registry
export {
  PaymentSettlementService,
  paymentSettlementService,
} from './paymentSettlement.service.js';

export {
  SettlementHandlerRegistry,
  settlementHandlerRegistry,
  DomainSettlementInterface,
  InvoiceSettlementHandler,
  invoiceSettlementHandler,
  AmenitySettlementHandler,
  amenitySettlementHandler,
  WalletRechargeSettlementHandler,
  walletRechargeSettlementHandler,
} from './settlement/index.js';

// 9. Payment Domain Utilities
export {
  resolvePaymentDomain,
  validateAuthoritativeAmount,
} from './payment.utils.js';

// 10. Core Feature Service, Repository, Events & Models
export { default as paymentService, PaymentService } from './payment.service.js';
export { default as paymentRepository } from './payment.repository.js';
export {
  paymentEventEmitter,
  PAYMENT_INITIATED,
  PAYMENT_SUCCESS,
  PAYMENT_FAILED,
  PAYMENT_REFUNDED,
} from './payment.events.js';
export { default as Payment } from './payment.model.js';
