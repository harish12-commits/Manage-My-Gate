import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import http from 'http';
import dotenv from 'dotenv';

import connectToDb from '../src/config/db/mongodbConnectToDb.config.js';
import { initSocket } from '../src/config/socket.js';

import Organization from '../src/features/organization/organization.model.js';
import User from '../src/features/user/user.model.js';
import Invoice from '../src/features/invoice/invoice.model.js';
import Amenity from '../src/features/amenity/amenity.model.js';
import AmenityBooking from '../src/features/amenityBooking/amenityBooking.model.js';
import { Wallet, WalletTransaction } from '../src/features/wallet/wallet.model.js';
import Payment from '../src/features/payment/payment.model.js';
import integrationHubService from '../src/features/integrationHub/integrationHub.service.js';

import {
  unifiedPaymentService,
  paymentSettlementService,
  PaymentContextFactory,
  PAYMENT_DOMAINS,
} from '../src/features/payment/index.js';

dotenv.config();
process.env.NODE_ENV = 'test';

describe('Phase 3: NAHOM Unified Payment Core & Webhook Ingress Test Suite', () => {
  let testOrgId;
  let testUserId;
  let testAmenityId;
  let httpServer;

  async function createTestInvoice(overrides = {}) {
    const amount = overrides.totalAmount || overrides.totalDue || 1000;
    const paid = overrides.paidAmount || 0;
    const outstanding = overrides.outstandingAmount !== undefined ? overrides.outstandingAmount : Math.max(0, amount - paid);
    const orgId = overrides.orgId || overrides.communityId || testOrgId;

    return await Invoice.create({
      orgId: orgId,
      communityId: orgId,
      assessmentId: new mongoose.Types.ObjectId(),
      targetUserId: overrides.targetUserId || testUserId,
      unitId: new mongoose.Types.ObjectId(),
      billingPeriodString: '2026-11',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invoiceNumber: overrides.invoiceNumber || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      currentCharge: amount,
      totalAmount: amount,
      totalDue: amount,
      paidAmount: paid,
      outstandingAmount: outstanding,
      status: overrides.status || (outstanding <= 0.01 ? 'PAID' : (paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID')),
      ...overrides,
    });
  }

  async function createTestBooking(overrides = {}) {
    const total = overrides.totalAmount || 400;
    return await AmenityBooking.create({
      orgId: overrides.orgId || testOrgId,
      amenityId: overrides.amenityId || testAmenityId,
      userId: overrides.userId || testUserId,
      bookingDate: overrides.bookingDate || '2026-11-20',
      startTime: overrides.startTime || '10:00',
      endTime: overrides.endTime || '11:00',
      pricingDetails: { totalAmount: total },
      paymentStatus: overrides.paymentStatus || 'pending',
      ...overrides,
    });
  }

  before(async () => {
    try {
      await connectToDb();

      httpServer = http.createServer();
      await initSocket(httpServer);

      testOrgId = new mongoose.Types.ObjectId();
      testUserId = new mongoose.Types.ObjectId();
      testAmenityId = new mongoose.Types.ObjectId();

      // 1. Create Test Organization
      await Organization.create({
        _id: testOrgId,
        name: 'Phase 3 Test Community',
        code: `P3_${Date.now()}`.substring(0, 10),
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '456 Core Blvd', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 2. Create Test Resident User
      await User.create({
        _id: testUserId,
        name: 'Phase 3 Resident',
        firstName: 'Phase3',
        lastName: 'Resident',
        email: `resident_${Date.now()}@example.com`,
        username: `res_${Date.now()}`,
        password: 'HashedPassword123!',
        userRole: 'resident',
        orgId: testOrgId,
        status: 'Active',
      });

      // 3. Create Test Amenity
      await Amenity.create({
        _id: testAmenityId,
        orgId: testOrgId,
        name: 'Tennis Court Phase 3',
        description: 'Championship court for testing',
        status: 'active',
        type: 'court',
        capacity: 4,
        pricing: {
          pricingType: 'hourly',
          baseRate: 400,
          weekendRateMultiplier: 1.0,
          taxPercentage: 0,
          securityDeposit: 0,
        },
        bookingRules: {
          openTime: '06:00',
          closeTime: '22:00',
          slotDurationMinutes: 60,
          advanceBookingDays: 30,
        },
      });

      // 4. Configure Razorpay test credentials in IntegrationHub for testOrg
      await integrationHubService.connect(
        testUserId,
        testOrgId,
        'razorpay',
        'Community Primary Razorpay',
        {
          keyId: 'rzp_test_12345678901234',
          keySecret: 'mock_key_secret_12345',
        }
      );
    } catch (setupError) {
      console.error('CRITICAL: Error in before() hook:', setupError);
      throw setupError;
    }
  });

  after(async () => {
    try {
      await Payment.deleteMany({ orgId: testOrgId });
      await Invoice.deleteMany({ communityId: testOrgId });
      await AmenityBooking.deleteMany({ orgId: testOrgId });
      await Amenity.deleteMany({ orgId: testOrgId });
      await Wallet.deleteMany({ orgId: testOrgId });
      await WalletTransaction.deleteMany({ orgId: testOrgId });
      await Organization.deleteMany({ _id: testOrgId });
      await User.deleteMany({ orgId: testOrgId });
    } finally {
      if (httpServer) {
        httpServer.close();
      }
      await mongoose.disconnect();
    }
  });

  // --------------------------------------------------------------------------
  // Test 1 — Invoice Order Creation
  // --------------------------------------------------------------------------
  test('Test 1 — Invoice Order: creates pending payment record with authoritative order', async () => {
    const invoice = await createTestInvoice({
      totalDue: 3500,
      totalAmount: 3500,
      paidAmount: 500,
      outstandingAmount: 3000,
      status: 'PARTIALLY_PAID',
    });

    // Remaining due is 3000. Create context for partial payment of 1500.
    const context = PaymentContextFactory.fromInvoice(invoice, { amount: 1500 });
    const orderResult = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    assert.equal(orderResult.success, true);
    assert.equal(orderResult.amount, 1500);
    assert.ok(orderResult.orderId.startsWith('order_mock_'));

    const paymentRecord = await Payment.findById(orderResult.paymentId);
    assert.ok(paymentRecord);
    assert.equal(paymentRecord.status, 'pending');
    assert.equal(paymentRecord.domain, PAYMENT_DOMAINS.INVOICE);
    assert.equal(paymentRecord.referenceType, 'Invoice');
    assert.equal(paymentRecord.amount, 1500);
  });

  // --------------------------------------------------------------------------
  // Test 2 — Amenity Order Creation
  // --------------------------------------------------------------------------
  test('Test 2 — Amenity Order: creates pending payment record matching booking pricing', async () => {
    const booking = await createTestBooking({
      totalAmount: 400,
      paymentStatus: 'pending',
    });

    const context = PaymentContextFactory.fromAmenityBooking(booking);
    const orderResult = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    assert.equal(orderResult.success, true);
    assert.equal(orderResult.amount, 400);

    const paymentRecord = await Payment.findById(orderResult.paymentId);
    assert.ok(paymentRecord);
    assert.equal(paymentRecord.status, 'pending');
    assert.equal(paymentRecord.domain, PAYMENT_DOMAINS.AMENITY);
    assert.equal(paymentRecord.amount, 400);
  });

  // --------------------------------------------------------------------------
  // Test 3 — Signature Verification (Valid vs Invalid)
  // --------------------------------------------------------------------------
  test('Test 3 — Signature Verification: valid signature settles; invalid signature fails', async () => {
    // 3a: Valid Signature
    const invoice = await createTestInvoice({
      totalDue: 2000,
      totalAmount: 2000,
      paidAmount: 0,
      outstandingAmount: 2000,
      status: 'UNPAID',
    });

    const context = PaymentContextFactory.fromInvoice(invoice, { amount: 2000 });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    const verificationResult = await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayPaymentId: `pay_sig_valid_${Date.now()}`,
      razorpaySignature: 'sig_mock_valid_hash',
      orgId: testOrgId,
    });

    assert.equal(verificationResult.success, true);
    assert.equal(verificationResult.payment.status, 'success');

    // 3b: Invalid Signature
    const invoice2 = await createTestInvoice({
      totalDue: 1000,
      totalAmount: 1000,
      paidAmount: 0,
      outstandingAmount: 1000,
      status: 'UNPAID',
    });

    const context2 = PaymentContextFactory.fromInvoice(invoice2, { amount: 1000 });
    const order2 = await unifiedPaymentService.createPaymentOrder(context2, { gateway: 'razorpay' });

    await assert.rejects(
      async () => {
        await unifiedPaymentService.verifyPayment({
          paymentId: order2.paymentId,
          orderId: order2.orderId,
          razorpayPaymentId: `pay_sig_fail_${Date.now()}`,
          razorpaySignature: 'invalid_tampered_signature_without_mock_prefix',
          orgId: testOrgId,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    const failedPayment = await Payment.findById(order2.paymentId);
    assert.equal(failedPayment.status, 'failed');
  });

  // --------------------------------------------------------------------------
  // Test 4 — Duplicate Webhook Idempotency (5 Concurrent Deliveries)
  // --------------------------------------------------------------------------
  test('Test 4 — Duplicate Webhook: 5 concurrent webhook calls result in exactly 1 settlement', async () => {
    const invoice = await createTestInvoice({
      totalDue: 1200,
      totalAmount: 1200,
      paidAmount: 0,
      outstandingAmount: 1200,
      status: 'UNPAID',
    });

    const context = PaymentContextFactory.fromInvoice(invoice, { amount: 1200 });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    const razorpayPaymentId = `pay_wh_concurrent_${Date.now()}`;
    const webhookPayload = {
      event: 'payment.captured',
      id: `evt_test_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: order.orderId,
            amount: 120000,
            currency: 'INR',
            status: 'captured',
            method: 'card',
            notes: {
              referenceId: invoice._id.toString(),
              domain: 'INVOICE',
              orgId: testOrgId.toString(),
            },
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(webhookPayload));

    // Send identical webhook 5 times concurrently
    const results = await Promise.all([
      unifiedPaymentService.processWebhook(rawBody, 'sig_mock_wh_1', {}),
      unifiedPaymentService.processWebhook(rawBody, 'sig_mock_wh_1', {}),
      unifiedPaymentService.processWebhook(rawBody, 'sig_mock_wh_1', {}),
      unifiedPaymentService.processWebhook(rawBody, 'sig_mock_wh_1', {}),
      unifiedPaymentService.processWebhook(rawBody, 'sig_mock_wh_1', {}),
    ]);

    for (const res of results) {
      assert.equal(res.success, true);
    }

    const updatedPayment = await Payment.findById(order.paymentId);
    assert.equal(updatedPayment.status, 'success');

    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.paidAmount, 1200);
    assert.equal(updatedInvoice.outstandingAmount, 0);
  });

  // --------------------------------------------------------------------------
  // Test 5 — Invoice Crash Simulation (No Split State)
  // --------------------------------------------------------------------------
  test('Test 5 — Crash Simulation: transaction aborts completely on domain error (no split state)', async () => {
    const fakeInvoiceId = new mongoose.Types.ObjectId();
    const payment = await Payment.create({
      orgId: testOrgId,
      userId: testUserId,
      referenceId: fakeInvoiceId,
      referenceType: 'Invoice',
      domain: 'INVOICE',
      amount: 900,
      status: 'pending',
      gateway: 'razorpay',
      gatewayOrderId: `order_crash_${Date.now()}`,
      gatewayTransactionId: `order_crash_${Date.now()}`,
    });

    await assert.rejects(
      async () => {
        await paymentSettlementService.settlePayment({
          paymentId: payment._id,
          gatewayTransactionId: `pay_crash_${Date.now()}`,
        });
      },
      (err) => {
        return true;
      }
    );

    const freshPayment = await Payment.findById(payment._id);
    assert.equal(freshPayment.status, 'pending');
  });

  // --------------------------------------------------------------------------
  // Test 6 — Amenity Settlement Consistency (PassToken & QR)
  // --------------------------------------------------------------------------
  test('Test 6 — Amenity Settlement: confirms booking, generates QR, passToken, and passTokenHash', async () => {
    const booking = await createTestBooking({
      totalAmount: 400,
      paymentStatus: 'pending',
    });

    const context = PaymentContextFactory.fromAmenityBooking(booking);
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    const verificationResult = await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayPaymentId: `pay_amenity_${Date.now()}`,
      razorpaySignature: 'sig_mock_amenity',
      orgId: testOrgId,
    });

    assert.equal(verificationResult.success, true);
    assert.equal(verificationResult.payment.status, 'success');

    const settledBooking = await AmenityBooking.findById(booking._id);
    assert.equal(settledBooking.paymentStatus, 'success');
    assert.equal(settledBooking.status, 'confirmed');
    assert.ok(settledBooking.passToken, 'passToken is generated');
    assert.ok(settledBooking.passTokenHash, 'passTokenHash is generated');
    assert.ok(settledBooking.qrCode, 'qrCode is generated');
  });

  // --------------------------------------------------------------------------
  // Test 7 — Wallet Recharge Atomic Settlement
  // --------------------------------------------------------------------------
  test('Test 7 — Wallet Recharge: payment success, wallet balance credit, and transaction are atomic', async () => {
    const rechargeContext = PaymentContextFactory.fromWalletRecharge({
      orgId: testOrgId,
      userId: testUserId,
      amount: 1500,
    });

    const order = await unifiedPaymentService.createPaymentOrder(rechargeContext, { gateway: 'razorpay' });
    assert.equal(order.amount, 1500);

    const verification = await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayPaymentId: `pay_wallet_atomic_${Date.now()}`,
      razorpaySignature: 'sig_mock_wallet',
      orgId: testOrgId,
    });

    assert.equal(verification.success, true);

    const wallet = await Wallet.findOne({ userId: testUserId, orgId: testOrgId });
    assert.ok(wallet);
    assert.ok(wallet.balance >= 1500);

    const txn = await WalletTransaction.findOne({ orgId: testOrgId, userId: testUserId }).sort({ createdAt: -1 });
    assert.ok(txn);
    assert.equal(txn.amount, 1500);
    assert.equal(txn.paymentStatus, 'success');
  });

  // --------------------------------------------------------------------------
  // Test 8 — Amount Tampering Protection
  // --------------------------------------------------------------------------
  test('Test 8 — Amount Tampering Protection: rejects client payload mismatching authoritative amount', async () => {
    const invoice = await createTestInvoice({
      totalDue: 1000,
      totalAmount: 1000,
      paidAmount: 500,
      outstandingAmount: 500,
      status: 'PARTIALLY_PAID',
    });

    const tamperedInvoiceContext = PaymentContextFactory.fromInvoice(invoice, { amount: 2500 });
    await assert.rejects(
      async () => {
        await unifiedPaymentService.createPaymentOrder(tamperedInvoiceContext, { gateway: 'razorpay' });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('exceeds remaining invoice due'));
        return true;
      }
    );

    const booking = await createTestBooking({
      totalAmount: 400,
      paymentStatus: 'pending',
    });

    const tamperedBookingContext = PaymentContextFactory.fromAmenityBooking(booking, { amount: 200 });
    await assert.rejects(
      async () => {
        await unifiedPaymentService.createPaymentOrder(tamperedBookingContext, { gateway: 'razorpay' });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('does not match required booking total'));
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Test 9 — Refund Idempotency & Limits
  // --------------------------------------------------------------------------
  test('Test 9 — Refund: processes refund once and rejects duplicate refund exceeding original payment', async () => {
    const invoice = await createTestInvoice({
      totalDue: 800,
      totalAmount: 800,
      paidAmount: 0,
      outstandingAmount: 800,
      status: 'UNPAID',
    });

    const context = PaymentContextFactory.fromInvoice(invoice, { amount: 800 });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      orderId: order.orderId,
      razorpayPaymentId: `pay_refund_src_${Date.now()}`,
      razorpaySignature: 'sig_mock_refund',
      orgId: testOrgId,
    });

    // 1st Refund: ₹800 (Full refund)
    const refundResult = await unifiedPaymentService.processRefund({
      paymentId: order.paymentId,
      amount: 800,
      notes: { reason: 'Resident requested refund' },
    });

    assert.equal(refundResult.success, true);
    assert.equal(refundResult.refund.amount, -800);
    assert.equal(refundResult.refund.type, 'Refund');

    // 2nd Refund: Attempting another ₹800 on same payment must be rejected
    await assert.rejects(
      async () => {
        await unifiedPaymentService.processRefund({
          paymentId: order.paymentId,
          amount: 800,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('exceeds original payment'));
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Test 10 — Provider Failure Handling
  // --------------------------------------------------------------------------
  test('Test 10 — Provider Failure: rejects order on unconfigured community without creating payment', async () => {
    const unconfiguredOrgId = new mongoose.Types.ObjectId();
    const invoice = await createTestInvoice({
      communityId: unconfiguredOrgId,
      totalDue: 500,
      totalAmount: 500,
      paidAmount: 0,
      outstandingAmount: 500,
      status: 'UNPAID',
    });

    const context = PaymentContextFactory.fromInvoice(invoice);

    await assert.rejects(
      async () => {
        await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('not been configured'));
        return true;
      }
    );

    const payment = await Payment.findOne({ orgId: unconfiguredOrgId });
    assert.equal(payment, null);

    await Invoice.deleteMany({ communityId: unconfiguredOrgId });
  });
});
