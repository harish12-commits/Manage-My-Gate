import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Test imports directly from barrel index and specific files
import {
  PAYMENT_DOMAINS,
  CANONICAL_PAYMENT_METHODS,
  CANONICAL_PAYMENT_STATUSES,
  PAYMENT_REFERENCE_TYPES,
  DEFAULT_CURRENCY,
  toCanonicalPaymentMethod,
  toLegacyPaymentMethod,
  toCanonicalPaymentStatus,
  toLegacyPaymentStatus,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  PaymentContext,
  validatePaymentContext,
  assertValidPaymentContext,
  generateIdempotencyKey,
  PaymentContextFactory,
  PaymentProviderFactory,
  paymentProviderFactory,
  PaymentConfigResolver,
  paymentConfigResolver,
  BillingPaymentAdapter,
  billingPaymentAdapter,
  AmenityPaymentAdapter,
  amenityPaymentAdapter,
  WalletPaymentAdapter,
  walletPaymentAdapter,
} from '../src/features/payment/index.js';

describe('Phase 2: NAHOM Unified Payment & Financial Contracts', () => {

  describe('1. Canonical Constants & Domain Definitions', () => {
    test('defines required canonical domains', () => {
      assert.equal(PAYMENT_DOMAINS.INVOICE, 'INVOICE');
      assert.equal(PAYMENT_DOMAINS.AMENITY, 'AMENITY');
      assert.equal(PAYMENT_DOMAINS.WALLET, 'WALLET');
    });

    test('defines standard payment methods', () => {
      assert.equal(CANONICAL_PAYMENT_METHODS.ONLINE, 'ONLINE');
      assert.equal(CANONICAL_PAYMENT_METHODS.WALLET, 'WALLET');
      assert.equal(CANONICAL_PAYMENT_METHODS.CASH, 'CASH');
      assert.equal(CANONICAL_PAYMENT_METHODS.CHEQUE, 'CHEQUE');
      assert.equal(CANONICAL_PAYMENT_METHODS.BANK_TRANSFER, 'BANK_TRANSFER');
    });

    test('defines full payment status lifecycle', () => {
      const statuses = Object.values(CANONICAL_PAYMENT_STATUSES);
      assert.ok(statuses.includes('CREATED'));
      assert.ok(statuses.includes('PENDING'));
      assert.ok(statuses.includes('PROCESSING'));
      assert.ok(statuses.includes('SUCCESS'));
      assert.ok(statuses.includes('FAILED'));
      assert.ok(statuses.includes('CANCELLED'));
      assert.ok(statuses.includes('REFUND_PENDING'));
      assert.ok(statuses.includes('PARTIALLY_REFUNDED'));
      assert.ok(statuses.includes('REFUNDED'));
    });

    test('defaults to INR currency', () => {
      assert.equal(DEFAULT_CURRENCY, 'INR');
    });
  });

  describe('2. Payment Method Mapping Utilities', () => {
    test('normalizes legacy and provider method strings to canonical methods', () => {
      assert.equal(toCanonicalPaymentMethod('wallet'), CANONICAL_PAYMENT_METHODS.WALLET);
      assert.equal(toCanonicalPaymentMethod('WALLET'), CANONICAL_PAYMENT_METHODS.WALLET);
      assert.equal(toCanonicalPaymentMethod('cash'), CANONICAL_PAYMENT_METHODS.CASH);
      assert.equal(toCanonicalPaymentMethod('PAY_AT_GATE'), CANONICAL_PAYMENT_METHODS.CASH);
      assert.equal(toCanonicalPaymentMethod('PAY-AT-GATE'), CANONICAL_PAYMENT_METHODS.CASH);
      assert.equal(toCanonicalPaymentMethod('cheque'), CANONICAL_PAYMENT_METHODS.CHEQUE);
      assert.equal(toCanonicalPaymentMethod('DD'), CANONICAL_PAYMENT_METHODS.CHEQUE);
      assert.equal(toCanonicalPaymentMethod('bank_transfer'), CANONICAL_PAYMENT_METHODS.BANK_TRANSFER);
      assert.equal(toCanonicalPaymentMethod('UPI'), CANONICAL_PAYMENT_METHODS.BANK_TRANSFER);
      assert.equal(toCanonicalPaymentMethod('NEFT'), CANONICAL_PAYMENT_METHODS.BANK_TRANSFER);
      assert.equal(toCanonicalPaymentMethod('razorpay'), CANONICAL_PAYMENT_METHODS.ONLINE);
      assert.equal(toCanonicalPaymentMethod('card'), CANONICAL_PAYMENT_METHODS.ONLINE);
      assert.equal(toCanonicalPaymentMethod(null), CANONICAL_PAYMENT_METHODS.ONLINE);
    });

    test('maps canonical methods to legacy target system formats', () => {
      assert.equal(toLegacyPaymentMethod(CANONICAL_PAYMENT_METHODS.CASH, 'AmenityBooking'), 'PAY_AT_GATE');
      assert.equal(toLegacyPaymentMethod(CANONICAL_PAYMENT_METHODS.CASH, 'Invoice'), 'CASH');
      assert.equal(toLegacyPaymentMethod(CANONICAL_PAYMENT_METHODS.WALLET, 'Invoice'), 'WALLET');
      assert.equal(toLegacyPaymentMethod(CANONICAL_PAYMENT_METHODS.ONLINE, 'Payment'), 'RAZORPAY');
    });
  });

  describe('3. Payment Status Mapping Utilities', () => {
    test('maps legacy statuses to canonical status', () => {
      assert.equal(toCanonicalPaymentStatus('PAID'), CANONICAL_PAYMENT_STATUSES.SUCCESS);
      assert.equal(toCanonicalPaymentStatus('success'), CANONICAL_PAYMENT_STATUSES.SUCCESS);
      assert.equal(toCanonicalPaymentStatus('SETTLED'), CANONICAL_PAYMENT_STATUSES.SUCCESS);
      assert.equal(toCanonicalPaymentStatus('UNPAID'), CANONICAL_PAYMENT_STATUSES.PENDING);
      assert.equal(toCanonicalPaymentStatus('pending'), CANONICAL_PAYMENT_STATUSES.PENDING);
      assert.equal(toCanonicalPaymentStatus('VERIFICATION_PENDING'), CANONICAL_PAYMENT_STATUSES.PENDING);
      assert.equal(toCanonicalPaymentStatus('PARTIALLY_PAID'), CANONICAL_PAYMENT_STATUSES.PROCESSING);
      assert.equal(toCanonicalPaymentStatus('FAILED'), CANONICAL_PAYMENT_STATUSES.FAILED);
      assert.equal(toCanonicalPaymentStatus('REFUNDED'), CANONICAL_PAYMENT_STATUSES.REFUNDED);
      assert.equal(toCanonicalPaymentStatus('PARTIAL_REFUND'), CANONICAL_PAYMENT_STATUSES.PARTIALLY_REFUNDED);
    });

    test('maps canonical status to legacy targets (Invoice, AmenityBooking, WalletTransaction, Payment)', () => {
      // Invoice
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.SUCCESS, 'Invoice'), 'PAID');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.PENDING, 'Invoice'), 'UNPAID');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.PENDING, 'Invoice', { isOffline: true }), 'VERIFICATION_PENDING');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.PROCESSING, 'Invoice'), 'PARTIALLY_PAID');

      // AmenityBooking
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.SUCCESS, 'AmenityBooking'), 'success');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.FAILED, 'AmenityBooking'), 'failed');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.PARTIALLY_REFUNDED, 'AmenityBooking'), 'partial_refund');

      // WalletTransaction
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.SUCCESS, 'WalletTransaction'), 'success');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.FAILED, 'WalletTransaction'), 'failed');

      // Payment model
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.SUCCESS, 'Payment'), 'success');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.PENDING, 'Payment'), 'pending');
      assert.equal(toLegacyPaymentStatus(CANONICAL_PAYMENT_STATUSES.SUCCESS, 'Payment', { isOffline: true }), 'PAID');
    });
  });

  describe('4. Precision-Safe Currency Math & Formatting', () => {
    test('converts Rupees to Paise avoiding IEEE 754 floating point distortion', () => {
      assert.equal(rupeesToPaise(19.99), 1999);
      assert.equal(rupeesToPaise(0.07), 7);
      assert.equal(rupeesToPaise('1000.55'), 100055);
      assert.equal(rupeesToPaise(500), 50000);
      assert.equal(rupeesToPaise(0), 0);
      assert.equal(rupeesToPaise('invalid'), 0);
    });

    test('converts Paise to Rupees accurately', () => {
      assert.equal(paiseToRupees(1999), 19.99);
      assert.equal(paiseToRupees(7), 0.07);
      assert.equal(paiseToRupees(50000), 500);
      assert.equal(paiseToRupees(0), 0);
    });

    test('formats Indian Rupees with currency symbol', () => {
      const formatted = formatINR(250000);
      assert.ok(formatted.includes('2,50,000'));
    });
  });

  describe('5. PaymentContext Contract & Validation', () => {
    test('creates an immutable PaymentContext with valid fields', () => {
      const ctx = new PaymentContext({
        domain: PAYMENT_DOMAINS.INVOICE,
        referenceId: 'inv_123',
        referenceType: PAYMENT_REFERENCE_TYPES.INVOICE,
        orgId: 'org_abc',
        userId: 'user_456',
        amount: 1500.50,
      });

      assert.equal(ctx.domain, 'INVOICE');
      assert.equal(ctx.referenceId, 'inv_123');
      assert.equal(ctx.referenceType, 'Invoice');
      assert.equal(ctx.orgId, 'org_abc');
      assert.equal(ctx.userId, 'user_456');
      assert.equal(ctx.payerUserId, 'user_456');
      assert.equal(ctx.amount, 1500.50);
      assert.equal(ctx.currency, 'INR');
      assert.equal(ctx.paymentMethod, 'ONLINE');
      assert.ok(ctx.idempotencyKey.startsWith('idemp_invoice_'));
      assert.ok(Object.isFrozen(ctx));
    });

    test('validatePaymentContext approves complete and valid context', () => {
      const ctx = new PaymentContext({
        domain: PAYMENT_DOMAINS.AMENITY,
        referenceId: 'book_789',
        referenceType: PAYMENT_REFERENCE_TYPES.AMENITY_BOOKING,
        orgId: 'org_abc',
        userId: 'user_123',
        amount: 250,
        paymentMethod: CANONICAL_PAYMENT_METHODS.WALLET,
      });

      const validation = validatePaymentContext(ctx);
      assert.equal(validation.isValid, true);
      assert.equal(validation.errors.length, 0);
    });

    test('validatePaymentContext detects missing and invalid fields', () => {
      const invalidCtx = {
        domain: 'INVALID_DOMAIN',
        referenceId: '',
        orgId: null,
        userId: '',
        amount: -50,
        currency: 'USD',
        paymentMethod: 'BITCOIN',
      };

      const validation = validatePaymentContext(invalidCtx);
      assert.equal(validation.isValid, false);
      assert.ok(validation.errors.some(e => e.includes('domain')));
      assert.ok(validation.errors.some(e => e.includes('referenceId')));
      assert.ok(validation.errors.some(e => e.includes('orgId')));
      assert.ok(validation.errors.some(e => e.includes('userId')));
      assert.ok(validation.errors.some(e => e.includes('amount')));
      assert.ok(validation.errors.some(e => e.includes('currency')));
      assert.ok(validation.errors.some(e => e.includes('paymentMethod')));
    });

    test('assertValidPaymentContext throws HttpError on invalid context', () => {
      assert.throws(
        () => {
          assertValidPaymentContext({
            domain: 'UNKNOWN',
            amount: 0,
          });
        },
        (err) => err.statusCode === 400 && err.message.includes('Payment context validation failed')
      );
    });

    test('generateIdempotencyKey generates deterministic prefix and structure', () => {
      const key1 = generateIdempotencyKey('INVOICE', 'inv_101', 'ONLINE', 'fixed_salt');
      const key2 = generateIdempotencyKey('INVOICE', 'inv_101', 'ONLINE', 'fixed_salt');
      assert.equal(key1, key2);
      assert.ok(key1.startsWith('idemp_invoice_'));
    });
  });

  describe('6. PaymentProviderFactory', () => {
    test('resolves registered providers (razorpay, mock)', () => {
      assert.ok(paymentProviderFactory.supportsProvider('razorpay'));
      assert.ok(paymentProviderFactory.supportsProvider('mock'));

      const razorpay = paymentProviderFactory.getProvider('razorpay');
      assert.ok(typeof razorpay.createOrder === 'function');
      assert.ok(typeof razorpay.verifySignature === 'function');
      assert.ok(typeof razorpay.refund === 'function');

      const mock = paymentProviderFactory.getProvider('mock');
      assert.ok(typeof mock.createOrder === 'function');
    });

    test('falls back to mock provider for unknown gateway when fallback is allowed', () => {
      const provider = paymentProviderFactory.getProvider('stripe_unregistered', { fallbackToMock: true });
      assert.ok(provider);
      assert.equal(provider.constructor.name, 'MockPaymentProvider');
    });

    test('throws when unknown provider requested without fallback', () => {
      assert.throws(
        () => {
          paymentProviderFactory.getProvider('non_existent_provider', { fallbackToMock: false });
        },
        (err) => err.statusCode === 400
      );
    });

    test('supports dynamic registration of custom provider matching contract', () => {
      const customFactory = new PaymentProviderFactory();
      const customProvider = {
        async createOrder() { return { orderId: 'custom_123' }; },
        async verifySignature() { return { isValid: true }; },
        async refund() { return { refundId: 'ref_123' }; },
      };

      customFactory.registerProvider('custom_gateway', customProvider);
      assert.ok(customFactory.supportsProvider('custom_gateway'));
      const retrieved = customFactory.getProvider('custom_gateway');
      assert.equal(retrieved, customProvider);
    });

    test('rejects registration of invalid provider missing required methods', () => {
      const customFactory = new PaymentProviderFactory();
      assert.throws(() => {
        customFactory.registerProvider('broken', { createOrder: () => {} });
      });
    });
  });

  describe('7. PaymentConfigResolver', () => {
    test('returns mock credentials for mock provider', async () => {
      const config = await paymentConfigResolver.getConfig({ provider: 'mock' });
      assert.equal(config.provider, 'mock');
      assert.equal(config.isConfigured, true);
      assert.equal(config.keyId, 'rzp_test_mockkey');
      assert.equal(config.source, 'mock');
    });

    test('sanitizes config object omitting secret keys', () => {
      const sanitized = paymentConfigResolver.sanitizeConfig({
        provider: 'razorpay',
        keyId: 'rzp_test_12345',
        keySecret: 'super_secret_secret',
        isConfigured: true,
        source: 'env',
      });

      assert.equal(sanitized.provider, 'razorpay');
      assert.equal(sanitized.keyId, 'rzp_test_12345');
      assert.equal(sanitized.isConfigured, true);
      assert.equal(sanitized.source, 'env');
      assert.equal(sanitized.keySecret, undefined);
    });

    test('validateConfig checks credential integrity', () => {
      assert.equal(paymentConfigResolver.validateConfig({ provider: 'mock' }), true);
      assert.equal(paymentConfigResolver.validateConfig({ provider: 'razorpay', keyId: 'key', keySecret: 'secret' }), true);
      assert.equal(paymentConfigResolver.validateConfig({ provider: 'razorpay', keyId: 'rzp_test_YOUR_KEY_ID_HERE', keySecret: 'secret' }), false);
      assert.equal(paymentConfigResolver.validateConfig(null), false);
    });
  });

  describe('8. PaymentContextFactory', () => {
    test('builds PaymentContext from Invoice document', () => {
      const mockInvoice = {
        _id: '507f1f77bcf86cd799439011',
        orgId: '507f1f77bcf86cd799439022',
        residentId: '507f1f77bcf86cd799439033',
        invoiceNumber: 'INV-2026-001',
        unitNumber: 'A-402',
        totalDue: 4500,
        paidAmount: 1000,
        currency: 'INR',
      };

      const ctx = PaymentContextFactory.fromInvoice(mockInvoice);
      assert.equal(ctx.domain, PAYMENT_DOMAINS.INVOICE);
      assert.equal(ctx.referenceId, '507f1f77bcf86cd799439011');
      assert.equal(ctx.referenceType, 'Invoice');
      assert.equal(ctx.orgId, '507f1f77bcf86cd799439022');
      assert.equal(ctx.userId, '507f1f77bcf86cd799439033');
      assert.equal(ctx.amount, 3500); // Remaining due (4500 - 1000)
      assert.equal(ctx.metadata.invoiceNumber, 'INV-2026-001');
      assert.equal(ctx.metadata.unitNumber, 'A-402');
    });

    test('builds PaymentContext from Invoice with custom partial payment amount', () => {
      const mockInvoice = {
        _id: '507f1f77bcf86cd799439011',
        orgId: '507f1f77bcf86cd799439022',
        residentId: '507f1f77bcf86cd799439033',
        totalDue: 5000,
        paidAmount: 0,
      };

      const ctx = PaymentContextFactory.fromInvoice(mockInvoice, { amount: 1500 });
      assert.equal(ctx.amount, 1500);
    });

    test('builds PaymentContext from AmenityBooking document', () => {
      const mockBooking = {
        _id: '607f1f77bcf86cd799439044',
        orgId: '507f1f77bcf86cd799439022',
        userId: '507f1f77bcf86cd799439033',
        amenityId: '707f1f77bcf86cd799439055',
        amenityName: 'Badminton Court 1',
        bookingNumber: 'BK-890',
        pricing: { totalPrice: 400 },
        paymentMethod: 'PAY_AT_GATE',
      };

      const ctx = PaymentContextFactory.fromAmenityBooking(mockBooking);
      assert.equal(ctx.domain, PAYMENT_DOMAINS.AMENITY);
      assert.equal(ctx.referenceId, '607f1f77bcf86cd799439044');
      assert.equal(ctx.referenceType, 'AmenityBooking');
      assert.equal(ctx.amount, 400);
      assert.equal(ctx.paymentMethod, CANONICAL_PAYMENT_METHODS.CASH); // PAY_AT_GATE mapped to CASH
      assert.equal(ctx.metadata.amenityName, 'Badminton Court 1');
    });

    test('builds PaymentContext for Wallet Recharge', () => {
      const rechargeData = {
        orgId: '507f1f77bcf86cd799439022',
        userId: '507f1f77bcf86cd799439033',
        amount: 2000,
        paymentMethod: 'ONLINE',
        metadata: { walletId: 'wal_999' },
      };

      const ctx = PaymentContextFactory.fromWalletRecharge(rechargeData);
      assert.equal(ctx.domain, PAYMENT_DOMAINS.WALLET);
      assert.equal(ctx.referenceType, 'WalletRecharge');
      assert.equal(ctx.amount, 2000);
      assert.equal(ctx.metadata.walletId, 'wal_999');
    });
  });

  describe('9. Domain Adapters (Billing, Amenity, Wallet)', () => {
    test('BillingPaymentAdapter creates context, format params and settlement payload', () => {
      const invoice = {
        _id: 'inv_test_1',
        orgId: 'org_test_1',
        residentId: 'user_test_1',
        totalDue: 1200,
        paidAmount: 200,
        invoiceNumber: 'INV-1200',
      };

      const ctx = billingPaymentAdapter.createPaymentContext(invoice);
      assert.equal(ctx.domain, 'INVOICE');
      assert.equal(ctx.amount, 1000);

      const params = billingPaymentAdapter.formatPaymentCreationParams(ctx, { gateway: 'mock' });
      assert.equal(params.orgId, 'org_test_1');
      assert.equal(params.amount, 1000);
      assert.equal(params.gateway, 'mock');

      const settlement = billingPaymentAdapter.formatSettlementPayload(ctx, {
        _id: 'pay_rec_1',
        gatewayTransactionId: 'txn_mock_999',
        amount: 1000,
      });

      assert.equal(settlement.invoiceId, 'inv_test_1');
      assert.equal(settlement.amountPaid, 1000);
      assert.equal(settlement.transactionId, 'txn_mock_999');
      assert.equal(settlement.auditEntry.action, 'PAYMENT_RECORDED');
    });

    test('AmenityPaymentAdapter formats booking payment updates', () => {
      const booking = {
        _id: 'book_test_1',
        orgId: 'org_test_1',
        userId: 'user_test_1',
        totalPrice: 500,
        paymentMethod: 'ONLINE',
      };

      const ctx = amenityPaymentAdapter.createPaymentContext(booking);
      const updatePayload = amenityPaymentAdapter.formatBookingPaymentUpdate(ctx, {
        status: 'SUCCESS',
        gatewayTransactionId: 'rzp_pay_888',
        amount: 500,
      });

      assert.equal(updatePayload.bookingId, 'book_test_1');
      assert.equal(updatePayload.paymentStatus, 'success');
      assert.equal(updatePayload.transactionId, 'rzp_pay_888');
      assert.equal(updatePayload.paymentMethod, 'RAZORPAY');
      assert.ok(updatePayload.paidAt instanceof Date);
    });

    test('WalletPaymentAdapter formats wallet transaction persistence payload', () => {
      const rechargeData = {
        orgId: 'org_test_1',
        userId: 'user_test_1',
        amount: 750,
        paymentMethod: 'ONLINE',
        metadata: { walletId: 'wal_user_1' },
      };

      const ctx = walletPaymentAdapter.createPaymentContext(rechargeData);
      const txnRecord = walletPaymentAdapter.formatWalletTransaction(ctx, {
        status: 'SUCCESS',
        gatewayTransactionId: 'order_wal_123',
        amount: 750,
      });

      assert.equal(txnRecord.walletId, 'wal_user_1');
      assert.equal(txnRecord.userId, 'user_test_1');
      assert.equal(txnRecord.amount, 750);
      assert.equal(txnRecord.type, 'credit');
      assert.equal(txnRecord.subType, 'recharge');
      assert.equal(txnRecord.status, 'success');
      assert.equal(txnRecord.gatewayTransactionId, 'order_wal_123');
    });
  });

});
