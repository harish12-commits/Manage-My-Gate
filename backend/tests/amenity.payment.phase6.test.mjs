/**
 * NAHOM — Unified Financial Architecture
 * Phase 6 Test Suite: Amenity Booking Payment Migration to Unified Payment Core
 * 
 * Validates:
 * 1. Online Payment Lifecycle via Unified Payment Core (Order creation, signature verification, settlement, ledger)
 * 2. Online Webhook Ingress & Idempotency Replay Safety
 * 3. Digital Wallet Payment for Amenity Bookings (Atomic deduction, canonical payment, ledger recording, insufficient balance protection)
 * 4. Pay-at-Gate / Cash Payment Workflow (Pending pass creation, gate cash recording, receipt, cash clearing ledger)
 * 5. Guard Check-In & Access Pass Validation (Pass token / QR verification, anti-replay enforcement)
 * 6. Cancellation & Compensating Refund Ledger Entries (Online refund, wallet refund)
 * 7. Security, Tenant Isolation & Financial Integrity (Cross-tenant rejection, amount tampering rejection, cancelled booking rejection)
 * 8. Transaction Rollback & Failure Protection (Atomic rollback on settlement failure)
 * 9. Financial Reconciliation Consistency Audit (Zero unledgered payments, clean audit status)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import http from 'http';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

import connectToDb from '../src/config/db/mongodbConnectToDb.config.js';
import { initSocket } from '../src/config/socket.js';

import Organization from '../src/features/organization/organization.model.js';
import User from '../src/features/user/user.model.js';
import Amenity from '../src/features/amenity/amenity.model.js';
import AmenityBooking from '../src/features/amenityBooking/amenityBooking.model.js';
import Payment from '../src/features/payment/payment.model.js';
import { Wallet, WalletTransaction } from '../src/features/wallet/wallet.model.js';
import amenityBookingService from '../src/features/amenityBooking/amenityBooking.services.js';
import { amenityAccessPassService } from '../src/features/amenityManagement/passes/amenityAccessPass.service.js';
import walletService from '../src/features/wallet/wallet.service.js';
import paymentService from '../src/features/payment/payment.service.js';
import integrationHubService from '../src/features/integrationHub/integrationHub.service.js';

import {
  financialLedgerService,
  financialLedgerRepository,
  FinancialLedgerEntry,
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
} from '../src/features/ledger/index.js';

import {
  unifiedPaymentService,
  paymentSettlementService,
  PaymentContextFactory,
  PAYMENT_DOMAINS,
  CANONICAL_PAYMENT_METHODS,
} from '../src/features/payment/index.js';

dotenv.config();
process.env.NODE_ENV = 'test';

describe('Phase 6: Amenity Booking Payment Migration to Unified Payment Core', () => {
  let testOrgId;
  let otherOrgId;
  let testUserId;
  let adminUserId;
  let testAmenity;
  let otherAmenity;
  let httpServer;

  const TIMEZONE = 'Asia/Kolkata';

  function getFutureBookingDate(daysAhead = 2) {
    return moment().tz(TIMEZONE).add(daysAhead, 'days').format('YYYY-MM-DD');
  }

  async function createTestBooking(overrides = {}) {
    const orgId = overrides.orgId || testOrgId;
    const amenityId = overrides.amenityId || testAmenity._id;
    const userId = overrides.userId || testUserId;
    const amount = overrides.totalAmount !== undefined ? overrides.totalAmount : 500;
    const bookingDate = overrides.bookingDate || getFutureBookingDate(2);
    const startTime = overrides.startTime || '14:00';
    const endTime = overrides.endTime || '15:00';

    return await AmenityBooking.create({
      orgId,
      amenityId,
      userId,
      bookingDate,
      startTime,
      endTime,
      status: overrides.status || 'pending',
      paymentStatus: overrides.paymentStatus || 'pending',
      paymentMethod: overrides.paymentMethod || 'ONLINE',
      numberOfPersons: overrides.numberOfPersons || 1,
      totalPrice: amount,
      pricingDetails: {
        baseAmount: amount,
        taxAmount: 0,
        discountAmount: 0,
        securityDeposit: 0,
        totalAmount: amount,
        refundAmount: 0,
        cancellationCharge: 0,
      },
      ...overrides,
    });
  }

  before(async () => {
    try {
      await connectToDb();

      httpServer = http.createServer();
      await initSocket(httpServer);

      testOrgId = new mongoose.Types.ObjectId();
      otherOrgId = new mongoose.Types.ObjectId();
      testUserId = new mongoose.Types.ObjectId();
      adminUserId = new mongoose.Types.ObjectId();

      const orgSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // 1. Primary Test Organization
      await Organization.create({
        _id: testOrgId,
        name: `Phase 6 Amenity Community ${orgSuffix}`,
        code: `P6A_${Date.now() % 10000000}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '700 Amenity Ave', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 2. Secondary Organization (for cross-tenant tests)
      await Organization.create({
        _id: otherOrgId,
        name: `Phase 6 Other Community ${orgSuffix}`,
        code: `P6O_${Date.now() % 10000000}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '800 Isolated Path', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 3. Resident User
      await User.create({
        _id: testUserId,
        name: 'Phase 6 Resident',
        firstName: 'Amenity',
        lastName: 'Resident',
        email: `amenity_resident_${Date.now()}@example.com`,
        username: `resident_p6_${Date.now()}`,
        password: 'HashedPassword123!',
        userRole: 'resident',
        orgId: testOrgId,
        status: 'Active',
      });

      // 4. Admin User
      await User.create({
        _id: adminUserId,
        name: 'Phase 6 Security Admin',
        firstName: 'Security',
        lastName: 'Admin',
        email: `admin_p6_${Date.now()}@example.com`,
        username: `admin_p6_${Date.now()}`,
        password: 'HashedPassword123!',
        userRole: 'admin',
        orgId: testOrgId,
        status: 'Active',
      });

      // 5. Connect Gateway in IntegrationHub for testOrgId
      await integrationHubService.connect(
        testUserId,
        testOrgId,
        'razorpay',
        'Phase 6 Razorpay Gateway',
        {
          keyId: 'rzp_test_p6_1234567890',
          keySecret: 'sec_test_p6_keysecret1234',
        }
      );

      // 6. Primary Amenity (Tennis Court)
      testAmenity = await Amenity.create({
        orgId: testOrgId,
        name: 'Championship Tennis Court',
        type: 'court',
        capacity: 4,
        pricing: {
          baseRate: 500,
          pricingType: 'hourly',
          securityDeposit: 0,
          taxPercentage: 0,
        },
        bookingRules: {
          slotDurationMinutes: 60,
          openTime: '06:00',
          closeTime: '23:00',
          advanceBookingDays: 30,
          isCancellationEnabled: true,
          cancellationRefundRules: [
            { cancelBeforeHours: 2, refundPercentage: 100 },
          ],
        },
        status: 'active',
      });

      // 7. Other Community Amenity (for cross-tenant tests)
      otherAmenity = await Amenity.create({
        orgId: otherOrgId,
        name: 'Other Community Pool',
        type: 'pool',
        capacity: 10,
        pricing: {
          baseRate: 300,
          pricingType: 'hourly',
          securityDeposit: 0,
          taxPercentage: 0,
        },
        bookingRules: {
          slotDurationMinutes: 60,
          openTime: '06:00',
          closeTime: '22:00',
          advanceBookingDays: 30,
        },
        status: 'active',
      });
    } catch (err) {
      console.error('CRITICAL: Error in Phase 6 before() hook:', err);
      throw err;
    }
  });

  after(async () => {
    try {
      await Payment.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await AmenityBooking.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Amenity.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Wallet.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await WalletTransaction.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await FinancialLedgerEntry.collection.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Organization.deleteMany({ _id: { $in: [testOrgId, otherOrgId] } });
      await User.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
    } catch (teardownErr) {
      console.error('Error during Phase 6 test teardown:', teardownErr);
    } finally {
      if (httpServer) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await mongoose.disconnect();
    }
  });

  // --------------------------------------------------------------------------
  // Group 1: Authoritative Online Payment Lifecycle via Unified Payment Core
  // --------------------------------------------------------------------------

  test('Test 1.1 — Order Creation: PaymentContextFactory constructs authoritative amenity order', async () => {
    const booking = await createTestBooking({ totalAmount: 500 });

    const context = PaymentContextFactory.fromAmenityBooking(booking, {
      amount: 500,
      userId: testUserId,
      orgId: testOrgId,
      paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
    });

    assert.equal(context.domain, PAYMENT_DOMAINS.AMENITY);
    assert.equal(context.referenceId, booking._id.toString());
    assert.equal(context.referenceType, 'AmenityBooking');
    assert.equal(context.amount, 500);
    assert.equal(context.currency, 'INR');
    assert.equal(context.orgId, testOrgId.toString());
    assert.equal(context.userId, testUserId.toString());
    assert.equal(context.paymentMethod, CANONICAL_PAYMENT_METHODS.ONLINE);
  });

  test('Test 1.2 — Unified Payment Order: creates pending Payment record for amenity booking', async () => {
    const booking = await createTestBooking({ totalAmount: 750 });

    const orderResult = await paymentService.createPaymentOrder({
      orgId: testOrgId,
      userId: testUserId,
      referenceId: booking._id,
      referenceType: 'AmenityBooking',
      amount: 750,
      gateway: 'razorpay',
    });

    assert.ok(orderResult.orderId, 'Gateway orderId must be generated');
    assert.ok(orderResult.paymentId, 'Internal paymentId must be generated');

    const paymentDoc = await Payment.findById(orderResult.paymentId);
    assert.ok(paymentDoc, 'Payment document must exist in database');
    assert.equal(paymentDoc.status, 'pending');
    assert.equal(paymentDoc.domain, PAYMENT_DOMAINS.AMENITY);
    assert.equal(paymentDoc.referenceType, 'AmenityBooking');
    assert.equal(paymentDoc.referenceId.toString(), booking._id.toString());
    assert.equal(paymentDoc.amount, 750);
  });

  test('Test 1.3 — Signature Verification & Atomic Settlement: settles payment, confirms booking, generates QR, and records ledger entry', async () => {
    const booking = await createTestBooking({ totalAmount: 1000 });

    const orderResult = await paymentService.createPaymentOrder({
      orgId: testOrgId,
      userId: testUserId,
      referenceId: booking._id,
      referenceType: 'AmenityBooking',
      amount: 1000,
      gateway: 'razorpay',
    });

    const verificationResult = await unifiedPaymentService.verifyPayment({
      orgId: testOrgId,
      paymentId: orderResult.paymentId,
      orderId: orderResult.orderId,
      razorpayPaymentId: `pay_amn_${Date.now()}`,
      razorpaySignature: 'sig_mock_amenity_signature_test',
    });

    assert.equal(verificationResult.success, true);
    assert.equal(verificationResult.payment.status, 'success');

    // 1. Verify AmenityBooking was atomically confirmed & QR pass generated
    const updatedBooking = await AmenityBooking.findById(booking._id);
    assert.equal(updatedBooking.status, 'confirmed');
    assert.equal(updatedBooking.paymentStatus, 'success');
    assert.ok(updatedBooking.passToken, 'passToken must be generated upon confirmation');
    assert.ok(updatedBooking.passTokenHash, 'passTokenHash must be computed');
    assert.ok(updatedBooking.qrCode, 'QR code must be generated');
    assert.equal(updatedBooking.qrStatus, 'active');
    assert.equal(updatedBooking.paymentId, orderResult.paymentId.toString());

    // 2. Verify Double-Entry Financial Ledger Entry
    const ledgerEntries = await financialLedgerRepository.findByPaymentId(orderResult.paymentId);
    assert.equal(ledgerEntries.length, 1, 'Exactly one ledger entry must be recorded');

    const ledger = ledgerEntries[0];
    assert.equal(ledger.domain, 'AMENITY');
    assert.equal(ledger.referenceType, 'AmenityBooking');
    assert.equal(ledger.referenceId.toString(), booking._id.toString());
    assert.equal(ledger.amount, 1000);
    assert.equal(ledger.status, LEDGER_STATUSES.POSTED);
    assert.equal(ledger.debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledger.creditAccount, FINANCIAL_ACCOUNTS.AMENITY_REVENUE);

    // Unified wallet rule: a card payment must never appear as a wallet debit (listeners run asynchronously)
    await new Promise((resolve) => setTimeout(resolve, 150));
    const walletTxns = await WalletTransaction.countDocuments({ referenceId: booking._id });
    assert.equal(walletTxns, 0, 'Razorpay amenity payments must not create wallet transactions');
  });

  test('Test 1.4— Settlement Idempotency: re-verifying settled payment does not duplicate ledger or corrupt pass tokens', async () => {
    const booking = await createTestBooking({ totalAmount: 500 });

    const orderResult = await paymentService.createPaymentOrder({
      orgId: testOrgId,
      userId: testUserId,
      referenceId: booking._id,
      referenceType: 'AmenityBooking',
      amount: 500,
      gateway: 'razorpay',
    });

    // First verification
    await unifiedPaymentService.verifyPayment({
      orgId: testOrgId,
      paymentId: orderResult.paymentId,
      orderId: orderResult.orderId,
      razorpayPaymentId: `pay_amn_idem_${Date.now()}`,
      razorpaySignature: 'sig_mock_amenity_signature_test',
    });

    const bookingAfterFirst = await AmenityBooking.findById(booking._id);
    const initialPassToken = bookingAfterFirst.passToken;

    // Second (duplicate) verification
    const repeatResult = await unifiedPaymentService.verifyPayment({
      orgId: testOrgId,
      paymentId: orderResult.paymentId,
      orderId: orderResult.orderId,
      razorpayPaymentId: `pay_amn_idem_${Date.now()}`,
      razorpaySignature: 'sig_mock_amenity_signature_test',
    });

    assert.equal(repeatResult.success, true);
    assert.equal(repeatResult.alreadySettled, true);

    // Ledger count remains exactly 1
    const ledgerEntries = await financialLedgerRepository.findByPaymentId(orderResult.paymentId);
    assert.equal(ledgerEntries.length, 1, 'Duplicate verification must NOT create duplicate ledger entry');

    // Pass token unchanged
    const bookingAfterSecond = await AmenityBooking.findById(booking._id);
    assert.equal(bookingAfterSecond.passToken, initialPassToken, 'Pass token must remain idempotent');
  });

  // --------------------------------------------------------------------------
  // Group 2: Authoritative Webhook Ingress & Idempotency
  // --------------------------------------------------------------------------

  test('Test 2.1 — Webhook Ingress: payment.captured event settles amenity booking and records ledger', async () => {
    const booking = await createTestBooking({ totalAmount: 800 });

    const orderResult = await paymentService.createPaymentOrder({
      orgId: testOrgId,
      userId: testUserId,
      referenceId: booking._id,
      referenceType: 'AmenityBooking',
      amount: 800,
      gateway: 'razorpay',
    });

    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_amn_${Date.now()}`,
            order_id: orderResult.orderId,
            amount: 80000, // paise
            currency: 'INR',
            status: 'captured',
            method: 'card',
            notes: {
              orgId: testOrgId.toString(),
              paymentId: orderResult.paymentId.toString(),
            },
          },
        },
      },
    };

    const webhookResult = await unifiedPaymentService.processWebhook(
      JSON.stringify(webhookPayload),
      'sig_mock_webhook_signature',
      { 'x-razorpay-signature': 'sig_mock_webhook_signature' }
    );

    assert.equal(webhookResult.success, true);
    assert.ok(webhookResult.paymentId);

    const updatedBooking = await AmenityBooking.findById(booking._id);
    assert.equal(updatedBooking.status, 'confirmed');
    assert.equal(updatedBooking.paymentStatus, 'success');
    assert.ok(updatedBooking.passToken);

    const ledgerEntries = await financialLedgerRepository.findByPaymentId(orderResult.paymentId);
    assert.equal(ledgerEntries.length, 1);
    assert.equal(ledgerEntries[0].debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledgerEntries[0].creditAccount, FINANCIAL_ACCOUNTS.AMENITY_REVENUE);
  });

  test('Test 2.2 — Webhook Replay: replaying webhook payload does not double-settle or corrupt state', async () => {
    const booking = await createTestBooking({ totalAmount: 600 });

    const orderResult = await paymentService.createPaymentOrder({
      orgId: testOrgId,
      userId: testUserId,
      referenceId: booking._id,
      referenceType: 'AmenityBooking',
      amount: 600,
      gateway: 'razorpay',
    });

    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_replay_amn_${Date.now()}`,
            order_id: orderResult.orderId,
            amount: 60000,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            notes: {
              orgId: testOrgId.toString(),
              paymentId: orderResult.paymentId.toString(),
            },
          },
        },
      },
    };

    const rawPayload = JSON.stringify(webhookPayload);

    // Initial delivery
    await unifiedPaymentService.processWebhook(rawPayload, 'sig_mock_webhook_signature', {});

    // Replay delivery
    const replayResult = await unifiedPaymentService.processWebhook(rawPayload, 'sig_mock_webhook_signature', {});
    assert.equal(replayResult.success, true);
    assert.match(replayResult.message, /already processed/i);

    const ledgerEntries = await financialLedgerRepository.findByPaymentId(orderResult.paymentId);
    assert.equal(ledgerEntries.length, 1, 'Replayed webhook must not create second ledger entry');
  });

  // --------------------------------------------------------------------------
  // Group 3: Digital Wallet Payment for Amenity Bookings
  // --------------------------------------------------------------------------

  test('Test 3.1 — Wallet Payment: resident books amenity using digital wallet with atomic deduction, canonical payment, and ledger', async () => {
    // 1. Credit wallet with ₹2000
    await walletService.creditWallet({
      userId: testUserId,
      orgId: testOrgId,
      amount: 2000,
      referenceType: 'Recharge',
      description: 'Test seed wallet',
    });
    const initialWallet = await walletService.getWallet(testUserId, testOrgId);
    const initialBalance = initialWallet.balance;

    // 2. Book amenity using paymentMethod: 'WALLET'
    const bookingData = {
      orgId: testOrgId,
      amenityId: testAmenity._id,
      userId: testUserId,
      bookingDate: getFutureBookingDate(3),
      startTime: '16:00',
      endTime: '17:00',
      numberOfPersons: 1,
      paymentMethod: 'WALLET',
    };

    const result = await amenityBookingService.createBooking(bookingData);
    assert.ok(result.booking, 'Booking must be returned');
    assert.equal(result.booking.status, 'confirmed');
    assert.equal(result.booking.paymentStatus, 'success');
    assert.equal(result.booking.paymentMethod, 'WALLET');
    assert.ok(result.booking.passToken, 'Pass token must be generated');
    assert.ok(result.booking.qrCode, 'QR code must be generated');

    // 3. Verify wallet balance was debited by exactly ₹500
    const updatedWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(updatedWallet.balance, initialBalance - 500);

    // 4. Verify exactly 1 WalletTransaction was recorded
    const walletTxns = await WalletTransaction.find({
      userId: testUserId,
      referenceType: 'AmenityBooking',
      referenceId: result.booking._id,
    });
    assert.equal(walletTxns.length, 1);
    assert.equal(walletTxns[0].type, 'Debit');
    assert.equal(walletTxns[0].amount, 500);
    assert.equal(walletTxns[0].paymentStatus, 'success');

    // 5. Verify Canonical Payment record was created
    const paymentDoc = await Payment.findOne({
      referenceType: 'AmenityBooking',
      referenceId: result.booking._id,
      paymentMethod: 'WALLET',
    });
    assert.ok(paymentDoc, 'Canonical Payment record must be created for wallet booking');
    assert.equal(paymentDoc.status, 'success');
    assert.equal(paymentDoc.domain, 'AMENITY');
    assert.equal(paymentDoc.amount, 500);

    // 6. Verify Double-Entry Financial Ledger Entry
    const ledgerEntries = await financialLedgerRepository.findByPaymentId(paymentDoc._id);
    assert.equal(ledgerEntries.length, 1);
    assert.equal(ledgerEntries[0].domain, 'AMENITY');
    assert.equal(ledgerEntries[0].amount, 500);
    assert.equal(ledgerEntries[0].debitAccount, FINANCIAL_ACCOUNTS.RESIDENT_WALLET);
    assert.equal(ledgerEntries[0].creditAccount, FINANCIAL_ACCOUNTS.AMENITY_REVENUE);
  });

  test('Test 3.2 — Insufficient Wallet Balance Rejection: zero side effects on balance or bookings', async () => {
    // 1. Current wallet balance is ₹1500 from previous test
    const currentWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.ok(currentWallet.balance > 0, 'Wallet must have positive balance from Test 3.1');

    // 2. Attempt to book amenity requiring ₹2000 (4 persons x ₹500 = ₹2000 > ₹1500 available)
    const bookingData = {
      orgId: testOrgId,
      amenityId: testAmenity._id,
      userId: testUserId,
      bookingDate: getFutureBookingDate(4),
      startTime: '10:00',
      endTime: '11:00',
      numberOfPersons: 4,
      paymentMethod: 'WALLET',
    };

    await assert.rejects(
      async () => {
        await amenityBookingService.createBooking(bookingData);
      },
      (err) => {
        assert.equal(err.statusCode || err.status, 400);
        assert.match(err.message, /Insufficient wallet balance/);
        return true;
      }
    );

    // 3. Confirm balance remains unchanged and no orphan records exist
    const postWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(postWallet.balance, currentWallet.balance);

    const orphanBooking = await AmenityBooking.findOne({
      orgId: testOrgId,
      bookingDate: getFutureBookingDate(4),
      startTime: '10:00',
      endTime: '11:00',
    });
    assert.equal(orphanBooking, null, 'No booking should be created on insufficient balance');
  });

  // --------------------------------------------------------------------------
  // Group 4: Pay-at-Gate / Cash Collection Workflow
  // --------------------------------------------------------------------------

  test('Test 4.1 — Pay-at-Gate Pass Creation: booking confirmed for slot with pending cash payment', async () => {
    const bookingData = {
      orgId: testOrgId,
      amenityId: testAmenity._id,
      userId: testUserId,
      bookingDate: getFutureBookingDate(5),
      startTime: '08:00',
      endTime: '09:00',
      numberOfPersons: 1,
      paymentMethod: 'PAY_AT_GATE',
    };

    const result = await amenityBookingService.createBooking(bookingData);
    assert.ok(result.booking);
    assert.equal(result.booking.status, 'confirmed');
    assert.equal(result.booking.paymentStatus, 'pending');
    assert.ok(['PAY_AT_GATE', 'CASH'].includes(result.booking.paymentMethod));
    assert.ok(result.booking.passToken, 'Pass token must be generated for gate presentation');
    assert.ok(result.booking.qrCode, 'QR code must be active');

    // Canonical pending payment created
    const paymentDoc = await Payment.findOne({
      referenceType: 'AmenityBooking',
      referenceId: result.booking._id,
      paymentMethod: 'CASH',
    });
    assert.ok(paymentDoc);
    assert.equal(paymentDoc.status, 'pending');
    assert.equal(paymentDoc.paymentCategory, 'OFFLINE');
  });

  test('Test 4.2 — Counter Cash Collection: records cash payment, updates canonical Payment, and posts CASH_CLEARING ledger', async () => {
    const booking = await createTestBooking({
      totalAmount: 500,
      paymentMethod: 'CASH',
      paymentStatus: 'pending',
      status: 'confirmed',
    });

    const cashResult = await amenityBookingService.recordCashPayment(
      booking._id,
      500,
      adminUserId,
      {
        orgId: testOrgId,
        notes: 'Collected at court reception',
      }
    );

    assert.ok(cashResult.receiptNumber);
    assert.equal(cashResult.booking.paymentStatus, 'success');
    assert.equal(cashResult.payment.status, 'success');
    assert.equal(cashResult.payment.paymentMethod, 'CASH');
    assert.equal(cashResult.payment.receiptNumber, cashResult.receiptNumber);

    // Verify Cash Clearing Double-Entry Ledger
    const ledger = cashResult.ledgerEntry;
    assert.ok(ledger);
    assert.equal(ledger.domain, 'AMENITY');
    assert.equal(ledger.debitAccount, FINANCIAL_ACCOUNTS.CASH_CLEARING);
    assert.equal(ledger.creditAccount, FINANCIAL_ACCOUNTS.AMENITY_REVENUE);
    assert.equal(ledger.amount, 500);
  });

  // --------------------------------------------------------------------------
  // Group 5: Guard Check-In & Access Pass Validation
  // --------------------------------------------------------------------------

  test('Test 5.1 — Guard Check-In: validates access pass and checks in booking', async () => {
    // Today's date with time window valid right now
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    const nowHour = moment().tz(TIMEZONE).hour();
    const startHour = String(nowHour).padStart(2, '0');
    const endHour = String((nowHour + 1) % 24).padStart(2, '0');

    const booking = await createTestBooking({
      bookingDate: today,
      startTime: `${startHour}:00`,
      endTime: `${endHour}:00`,
      status: 'confirmed',
      paymentStatus: 'success',
      paymentMethod: 'ONLINE',
    });

    const { passToken } = await amenityBookingService.generateAccessQRCode(booking._id);

    const checkInResult = await amenityBookingService.checkInBooking(
      passToken,
      testOrgId,
      adminUserId
    );

    assert.ok(checkInResult.success);
    assert.match(checkInResult.message, /Pass validated|Access Granted/i);

    const refreshedBooking = await AmenityBooking.findById(booking._id);
    assert.equal(refreshedBooking.status, 'checked-in');
    assert.ok(refreshedBooking.checkInTime);
  });

  test('Test 5.2 — Anti-Replay Protection: scanning same pass a second time throws 409 Conflict', async () => {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    const nowHour = moment().tz(TIMEZONE).hour();
    const startHour = String(nowHour).padStart(2, '0');
    const endHour = String((nowHour + 1) % 24).padStart(2, '0');

    const booking = await createTestBooking({
      bookingDate: today,
      startTime: `${startHour}:00`,
      endTime: `${endHour}:00`,
      status: 'confirmed',
      paymentStatus: 'success',
      paymentMethod: 'ONLINE',
    });

    const { passToken } = await amenityBookingService.generateAccessQRCode(booking._id);

    // First check-in succeeds
    await amenityBookingService.checkInBooking(passToken, testOrgId, adminUserId);

    // Second check-in must fail with 409
    await assert.rejects(
      async () => {
        await amenityBookingService.checkInBooking(passToken, testOrgId, adminUserId);
      },
      (err) => {
        assert.equal(err.statusCode || err.status, 409);
        assert.match(err.message, /Anti-replay violation/i);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Group 6: Cancellation & Compensating Refund Ledger Entries
  // --------------------------------------------------------------------------

  test('Test 6.1 — Online Booking Refund: cancels booking, updates status, and records compensating ledger entry', async () => {
    const booking = await createTestBooking({
      totalAmount: 500,
      paymentMethod: 'ONLINE',
      paymentStatus: 'success',
      status: 'confirmed',
      bookingDate: getFutureBookingDate(7),
      startTime: '18:00',
      endTime: '19:00',
    });

    // Create settled canonical payment
    const payment = await Payment.create({
      orgId: testOrgId,
      userId: testUserId,
      domain: 'AMENITY',
      referenceType: 'AmenityBooking',
      referenceId: booking._id,
      amount: 500,
      currency: 'INR',
      paymentMethod: 'ONLINE',
      status: 'success',
      paidAt: new Date(),
      gatewayTransactionId: `pay_refund_test_${Date.now()}`,
    });

    booking.paymentId = payment._id.toString();
    await booking.save();

    // Record initial settlement ledger
    await financialLedgerService.recordSettlementLedgerEntry(payment, 'AMENITY');

    // Cancel booking with refund
    const refundResult = await unifiedPaymentService.processRefund({
      paymentId: payment._id,
      amount: 500,
      notes: { reason: 'Resident requested cancellation' },
    });

    assert.equal(refundResult.success, true);
    assert.equal(refundResult.refund.status, 'success');

    // Verify compensating refund ledger entry
    const refundLedger = await FinancialLedgerEntry.findOne({
      paymentId: payment._id,
      domain: 'REFUND',
    });

    assert.ok(refundLedger, 'Compensating refund ledger entry must exist');
    assert.equal(refundLedger.amount, 500);
    assert.equal(refundLedger.debitAccount, FINANCIAL_ACCOUNTS.REVENUE_ADJUSTMENT);
    assert.equal(refundLedger.creditAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);

    // Verify booking cancellation status
    const cancelledBooking = await AmenityBooking.findById(booking._id);
    assert.equal(cancelledBooking.status, 'cancelled');
    assert.equal(cancelledBooking.paymentStatus, 'refunded');
  });

  test('Test 6.2 — Wallet Booking Cancellation: credits wallet balance and posts compensating ledger entry', async () => {
    const preWallet = await walletService.getWallet(testUserId, testOrgId);

    // 1. Book with wallet
    const bookingData = {
      orgId: testOrgId,
      amenityId: testAmenity._id,
      userId: testUserId,
      bookingDate: getFutureBookingDate(8),
      startTime: '11:00',
      endTime: '12:00',
      numberOfPersons: 1,
      paymentMethod: 'WALLET',
    };
    const { booking } = await amenityBookingService.createBooking(bookingData);

    // 2. Cancel the booking
    const cancelled = await amenityBookingService.cancelBooking(
      booking._id,
      testUserId,
      testOrgId,
      'Change of plans'
    );

    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.paymentStatus, 'refunded');

    // 3. Wallet balance refunded back
    const postWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(postWallet.balance, preWallet.balance);

    // 4. Compensating ledger entry recorded
    const refundLedgers = await FinancialLedgerEntry.find({
      referenceId: booking._id,
      referenceType: 'Refund',
    });
    assert.ok(refundLedgers.length >= 1, 'Wallet refund ledger entry must be recorded');
    assert.equal(refundLedgers[0].debitAccount, FINANCIAL_ACCOUNTS.REVENUE_ADJUSTMENT);
    assert.equal(refundLedgers[0].creditAccount, FINANCIAL_ACCOUNTS.RESIDENT_WALLET);
  });

  test('Test 6.3 — Gateway Refund Wallet Isolation: card refund never writes a wallet transaction or changes balance', async () => {
    const preWallet = await walletService.getWallet(testUserId, testOrgId);
    const booking = await createTestBooking({
      totalAmount: 400,
      paymentMethod: 'ONLINE',
      paymentStatus: 'success',
      status: 'confirmed',
      bookingDate: getFutureBookingDate(9),
      startTime: '18:00',
      endTime: '19:00',
    });
    const payment = await Payment.create({
      orgId: testOrgId,
      userId: testUserId,
      domain: 'AMENITY',
      referenceType: 'AmenityBooking',
      referenceId: booking._id,
      amount: 400,
      currency: 'INR',
      paymentMethod: 'ONLINE',
      status: 'success',
      paidAt: new Date(),
      gatewayTransactionId: `pay_isolation_test_${Date.now()}`,
    });
    await financialLedgerService.recordSettlementLedgerEntry(payment, 'AMENITY');

    await unifiedPaymentService.processRefund({ paymentId: payment._id, amount: 400 });
    // PAYMENT_REFUNDED listeners run asynchronously after emit
    await new Promise((resolve) => setTimeout(resolve, 150));

    const walletTxns = await WalletTransaction.countDocuments({ referenceId: booking._id });
    assert.equal(walletTxns, 0, 'Card refunds must not create wallet transactions');
    const postWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(postWallet.balance, preWallet.balance);
  });

  test('Test 6.4 — Online Booking Without Gateway ID: cancellation refunds to unified wallet with ledger entry', async () => {
    const preWallet = await walletService.getWallet(testUserId, testOrgId);
    const booking = await createTestBooking({
      totalAmount: 300,
      paymentMethod: 'ONLINE',
      paymentStatus: 'success',
      status: 'confirmed',
      bookingDate: getFutureBookingDate(10),
      startTime: '18:00',
      endTime: '19:00',
    });

    const cancelled = await amenityBookingService.cancelBooking(booking._id, testUserId, testOrgId, 'No gateway id');
    assert.equal(cancelled.paymentStatus, 'refunded');

    const postWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(postWallet.balance, preWallet.balance + 300);

    const refundTxn = await WalletTransaction.findOne({ transactionId: `AMENITY-REFUND-${booking._id.toString()}` });
    assert.ok(refundTxn, 'Refund wallet transaction must exist');
    assert.equal(refundTxn.paymentStatus, 'success');
    assert.equal(refundTxn.referenceType, 'Refund');

    const refundLedger = await FinancialLedgerEntry.findOne({ referenceId: booking._id, referenceType: 'Refund' });
    assert.ok(refundLedger, 'Wallet refund ledger entry must be recorded');
    assert.equal(refundLedger.creditAccount, FINANCIAL_ACCOUNTS.RESIDENT_WALLET);
  });

  test('Test 6.5 — Wallet Refund Idempotency: the same booking can never be refunded to the wallet twice', async () => {
    const booking = await createTestBooking({ totalAmount: 250, paymentMethod: 'WALLET', paymentStatus: 'success' });
    const preWallet = await walletService.getWallet(testUserId, testOrgId);
    const refundArgs = { targetUserId: testUserId, orgId: testOrgId, refundAmount: 250, refundPercentage: 100, booking };

    await amenityBookingService._refundToWallet(refundArgs);
    const second = await amenityBookingService._refundToWallet(refundArgs);
    assert.equal(second.alreadyProcessed, true);

    const postWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(postWallet.balance, preWallet.balance + 250);
    const ledgers = await FinancialLedgerEntry.countDocuments({ referenceId: booking._id, referenceType: 'Refund' });
    assert.equal(ledgers, 1);
  });

  // --------------------------------------------------------------------------
  // Group 7: Security, Tenant Isolation & Financial Integrity
  // --------------------------------------------------------------------------

  test('Test 7.1 — Cross-Tenant Payment Rejection: payment attempt for other organization throws 403 Forbidden', async () => {
    // Booking belongs to otherOrgId
    const foreignBooking = await createTestBooking({
      orgId: otherOrgId,
      amenityId: otherAmenity._id,
      totalAmount: 300,
    });

    await assert.rejects(
      async () => {
        await paymentService.createPaymentOrder({
          orgId: testOrgId, // Mismatched tenant
          userId: testUserId,
          referenceId: foreignBooking._id,
          referenceType: 'AmenityBooking',
          amount: 300,
        });
      },
      (err) => {
        assert.equal(err.statusCode || err.status, 403);
        assert.match(err.message, /Cross-tenant payment forbidden/i);
        return true;
      }
    );
  });

  test('Test 7.2 — Amount Tampering Rejection: underpayment attempt throws 400 Bad Request', async () => {
    const booking = await createTestBooking({ totalAmount: 1000 });

    await assert.rejects(
      async () => {
        await paymentService.createPaymentOrder({
          orgId: testOrgId,
          userId: testUserId,
          referenceId: booking._id,
          referenceType: 'AmenityBooking',
          amount: 100, // Tampered: expected 1000
        });
      },
      (err) => {
        assert.equal(err.statusCode || err.status, 400);
        assert.match(err.message, /does not match required booking total/i);
        return true;
      }
    );
  });

  test('Test 7.3 — Overpayment Rejection: paying more than required throws 400 Bad Request', async () => {
    const booking = await createTestBooking({ totalAmount: 500 });

    await assert.rejects(
      async () => {
        await paymentService.createPaymentOrder({
          orgId: testOrgId,
          userId: testUserId,
          referenceId: booking._id,
          referenceType: 'AmenityBooking',
          amount: 1500, // Overpayment
        });
      },
      (err) => {
        assert.equal(err.statusCode || err.status, 400);
        assert.match(err.message, /does not match required booking total/i);
        return true;
      }
    );
  });

  test('Test 7.4 — Cancelled Booking Payment Rejection: payment on cancelled booking throws 400', async () => {
    const booking = await createTestBooking({
      totalAmount: 500,
      status: 'cancelled',
      paymentStatus: 'pending',
    });

    await assert.rejects(
      async () => {
        await paymentService.createPaymentOrder({
          orgId: testOrgId,
          userId: testUserId,
          referenceId: booking._id,
          referenceType: 'AmenityBooking',
          amount: 500,
        });
      },
      (err) => {
        assert.equal(err.statusCode || err.status, 400);
        assert.match(err.message, /cancelled or rejected/i);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Group 8: Transaction Rollback Protection
  // --------------------------------------------------------------------------

  test('Test 8.1 — Rollback Protection: failure in financial ledger rolls back settlement and booking state', async () => {
    const booking = await createTestBooking({ totalAmount: 500 });

    const payment = await Payment.create({
      orgId: testOrgId,
      userId: testUserId,
      domain: 'AMENITY',
      referenceType: 'AmenityBooking',
      referenceId: booking._id,
      amount: 500,
      currency: 'INR',
      paymentMethod: 'ONLINE',
      status: 'pending',
    });

    // Temporarily monkey-patch financialLedgerService to simulate database ledger failure
    const originalRecord = financialLedgerService.recordSettlementLedgerEntry;
    financialLedgerService.recordSettlementLedgerEntry = async () => {
      throw new Error('Simulated Database Crash during Ledger Entry');
    };

    try {
      await assert.rejects(
        async () => {
          await paymentSettlementService.settlePayment({
            paymentId: payment._id,
            gatewayTransactionId: 'txn_crash_test',
          });
        },
        (err) => {
          assert.match(err.message, /Simulated Database Crash/);
          return true;
        }
      );

      // Verify that payment status was NOT marked as success
      const refreshedPayment = await Payment.findById(payment._id);
      assert.notEqual(refreshedPayment.status, 'success');

      // Verify booking was NOT confirmed
      const refreshedBooking = await AmenityBooking.findById(booking._id);
      assert.notEqual(refreshedBooking.paymentStatus, 'success');
      assert.notEqual(refreshedBooking.status, 'confirmed');
    } finally {
      financialLedgerService.recordSettlementLedgerEntry = originalRecord;
    }
  });

  // --------------------------------------------------------------------------
  // Group 9: Financial Reconciliation Consistency Audit
  // --------------------------------------------------------------------------

  test('Test 9.1 — Reconciliation Auditor: verifies zero unledgered payments and perfect balance math', async () => {
    const auditReport = await financialLedgerService.checkReconciliation(testOrgId);

    assert.equal(auditReport.isClean, true, `Audit must be clean. Discrepancies: ${JSON.stringify(auditReport)}`);
    assert.equal(auditReport.paymentsWithoutLedger.length, 0, 'Zero successful payments without ledger');
    assert.equal(auditReport.walletTransactionsWithoutLedger.length, 0, 'Zero wallet transactions without ledger');
    assert.equal(auditReport.divergentWalletBalances.length, 0, 'Zero divergent wallet balances');
  });
});
