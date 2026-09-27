/**
 * NAHOM — Unified Financial Architecture
 * Phase 4 Test Suite: Double-Entry Financial Ledger + Wallet Atomicity Foundation
 * 
 * Validates:
 * 1. Ledger Invariants (Balanced Debits/Credits, Immutability, Idempotency)
 * 2. Wallet Atomicity (Atomic Debit, Overdraft Prevention under Concurrency, Atomic Credit)
 * 3. Wallet + Ledger Transaction Boundaries (Full Rollback on Failure)
 * 4. Domain Integration (Recharge + Ledger, Wallet -> Invoice + Ledger, Wallet -> Amenity + Ledger, Refund + Ledger)
 * 5. Tenant Isolation & Security (Cross-Tenant Access Rejection, Amount Tampering)
 * 6. Reconciliation Consistency Auditor
 */

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
  financialLedgerService,
  financialLedgerRepository,
  FinancialLedgerEntry,
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
} from '../src/features/ledger/index.js';

import walletService from '../src/features/wallet/wallet.service.js';
import {
  unifiedPaymentService,
  paymentSettlementService,
  PaymentContextFactory,
  PAYMENT_DOMAINS,
} from '../src/features/payment/index.js';

dotenv.config();
process.env.NODE_ENV = 'test';

describe('Phase 4: Double-Entry Financial Ledger + Wallet Atomicity Foundation', () => {
  let testOrgId;
  let otherOrgId;
  let testUserId;
  let testAmenityId;
  let httpServer;

  async function createTestInvoice(overrides = {}) {
    const amount = overrides.totalAmount || overrides.totalDue || 1500;
    const paid = overrides.paidAmount || 0;
    const outstanding = overrides.outstandingAmount !== undefined ? overrides.outstandingAmount : Math.max(0, amount - paid);
    const orgId = overrides.orgId || overrides.communityId || testOrgId;

    return await Invoice.create({
      orgId,
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
    const total = overrides.totalAmount || 600;
    return await AmenityBooking.create({
      orgId: overrides.orgId || testOrgId,
      amenityId: overrides.amenityId || testAmenityId,
      userId: overrides.userId || testUserId,
      bookingDate: overrides.bookingDate || '2026-11-25',
      startTime: overrides.startTime || '14:00',
      endTime: overrides.endTime || '15:00',
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
      otherOrgId = new mongoose.Types.ObjectId();
      testUserId = new mongoose.Types.ObjectId();
      testAmenityId = new mongoose.Types.ObjectId();

      // 1. Primary Test Organization
      const orgSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await Organization.create({
        _id: testOrgId,
        name: `Phase 4 Primary Community ${orgSuffix}`,
        code: `P4_${Date.now() % 10000000}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '100 Ledger Way', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 2. Second Organization (for cross-tenant tests)
      await Organization.create({
        _id: otherOrgId,
        name: `Phase 4 Foreign Community ${orgSuffix}`,
        code: `P4F_${Date.now() % 10000000}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '200 Boundary Rd', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 3. Resident User
      await User.create({
        _id: testUserId,
        name: 'Phase 4 Resident',
        firstName: 'Ledger',
        lastName: 'Resident',
        email: `ledger_res_${Date.now()}@example.com`,
        username: `ledger_${Date.now()}`,
        password: 'HashedPassword123!',
        userRole: 'resident',
        orgId: testOrgId,
        status: 'Active',
      });

      // 4. Amenity
      await Amenity.create({
        _id: testAmenityId,
        orgId: testOrgId,
        name: 'Clubhouse Phase 4',
        status: 'active',
        type: 'hall',
        capacity: 50,
        pricing: {
          pricingType: 'fixed',
          baseRate: 600,
          weekendRateMultiplier: 1.0,
          taxPercentage: 0,
          securityDeposit: 0,
        },
        bookingRules: {
          openTime: '08:00',
          closeTime: '22:00',
          slotDurationMinutes: 60,
          advanceBookingDays: 30,
        },
      });

      // 5. Connect Gateway in IntegrationHub for testOrgId
      await integrationHubService.connect(
        testUserId,
        testOrgId,
        'razorpay',
        'Phase 4 Razorpay Connection',
        {
          keyId: 'rzp_test_p4_1234567890',
          keySecret: 'sec_test_p4_keysecret1234',
        }
      );
    } catch (err) {
      console.error('CRITICAL: Error in before() hook:', err);
      throw err;
    }
  });

  after(async () => {
    try {
      await Payment.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Invoice.deleteMany({ communityId: { $in: [testOrgId, otherOrgId] } });
      await AmenityBooking.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Amenity.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Wallet.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await WalletTransaction.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await FinancialLedgerEntry.collection.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Organization.deleteMany({ _id: { $in: [testOrgId, otherOrgId] } });
      await User.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
    } catch (teardownErr) {
      console.error('Error during test teardown:', teardownErr);
    } finally {
      if (httpServer) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await mongoose.disconnect();
    }
  });

  // --------------------------------------------------------------------------
  // Group 1: Double-Entry Ledger Invariants & Immutability
  // --------------------------------------------------------------------------

  test('Test 1.1 — Double-Entry Balance Invariant: SUM(debits) must equal SUM(credits)', async () => {
    // Attempt to manually save an unbalanced ledger entry
    const unbalancedEntry = new FinancialLedgerEntry({
      transactionId: `FTX-UNBAL-${Date.now()}`,
      orgId: testOrgId,
      domain: 'INVOICE',
      referenceType: 'Invoice',
      referenceId: new mongoose.Types.ObjectId(),
      debitAccount: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING,
      creditAccount: FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE,
      amount: 1000,
      idempotencyKey: `unbal_${Date.now()}`,
      entries: [
        { account: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING, entryType: ENTRY_TYPES.DEBIT, amount: 1000 },
        { account: FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE, entryType: ENTRY_TYPES.CREDIT, amount: 900 }, // 1000 != 900
      ],
    });

    await assert.rejects(
      async () => {
        await unbalancedEntry.save();
      },
      (err) => {
        assert.ok(err.message.includes('Double-entry balance invariant violated'));
        return true;
      }
    );
  });

  test('Test 1.2 — Ledger Immutability: direct update or delete on ledger entries is forbidden', async () => {
    const validEntry = new FinancialLedgerEntry({
      transactionId: `FTX-IMMUTABLE-${Date.now()}`,
      orgId: testOrgId,
      domain: 'AMENITY',
      referenceType: 'AmenityBooking',
      referenceId: new mongoose.Types.ObjectId(),
      debitAccount: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING,
      creditAccount: FINANCIAL_ACCOUNTS.AMENITY_REVENUE,
      amount: 500,
      idempotencyKey: `immutable_${Date.now()}`,
    });
    const saved = await validEntry.save();

    // Verify update is blocked
    await assert.rejects(
      async () => {
        await FinancialLedgerEntry.updateOne({ _id: saved._id }, { $set: { amount: 600 } });
      },
      (err) => {
        assert.ok(err.message.includes('immutable. Direct updates are strictly forbidden'));
        return true;
      }
    );

    // Verify delete is blocked
    await assert.rejects(
      async () => {
        await FinancialLedgerEntry.deleteOne({ _id: saved._id });
      },
      (err) => {
        assert.ok(err.message.includes('immutable. Deletions are strictly forbidden'));
        return true;
      }
    );
  });

  test('Test 1.3 — Ledger Idempotency: duplicate entry creation with same idempotencyKey is idempotent', async () => {
    const uniqueKey = `idemp_test_${Date.now()}`;
    const payload = {
      transactionId: `FTX-IDEMP-${Date.now()}`,
      orgId: testOrgId,
      domain: 'WALLET',
      referenceType: 'Wallet',
      referenceId: new mongoose.Types.ObjectId(),
      debitAccount: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING,
      creditAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
      amount: 750,
      idempotencyKey: uniqueKey,
    };

    // First creation
    const { entry: entry1, alreadyExists: exists1 } = await financialLedgerRepository.createEntry(payload);
    assert.equal(exists1, false);
    assert.equal(entry1.amount, 750);

    // Second creation (concurrent simulation)
    const { entry: entry2, alreadyExists: exists2 } = await financialLedgerRepository.createEntry(payload);
    assert.equal(exists2, true);
    assert.equal(entry2._id.toString(), entry1._id.toString());
  });

  // --------------------------------------------------------------------------
  // Group 2: Wallet Atomicity & Overdraft Prevention
  // --------------------------------------------------------------------------

  test('Test 2.1 — Atomic Debit: debit with sufficient balance succeeds and creates WalletTransaction', async () => {
    // Top up wallet with ₹1,000 first
    await walletService.creditWallet({
      userId: testUserId,
      orgId: testOrgId,
      amount: 1000,
      description: 'Initial seed funds',
    });

    const debitResult = await walletService.debitWallet({
      userId: testUserId,
      orgId: testOrgId,
      amount: 400,
      referenceType: 'Other',
      description: 'Coffee expense',
    });

    assert.equal(debitResult.wallet.balance, 600);
    assert.equal(debitResult.transaction.type, 'Debit');
    assert.equal(debitResult.transaction.amount, 400);

    // Verify polymorphic reference field
    assert.ok(debitResult.transaction.referenceModel);
  });

  test('Test 2.2 — Insufficient Balance: debit exceeding available balance is rejected', async () => {
    // Current balance is ₹600. Try to debit ₹800.
    await assert.rejects(
      async () => {
        await walletService.debitWallet({
          userId: testUserId,
          orgId: testOrgId,
          amount: 800,
          referenceType: 'Other',
          description: 'Expensive item',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Insufficient wallet balance'));
        return true;
      }
    );

    // Balance remains exactly ₹600
    const wallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(wallet.balance, 600);
  });

  test('Test 2.3 — Concurrent Debits (Race Condition Test): two simultaneous debits against exact same balance', async () => {
    // Current balance is ₹600. Set balance to exactly ₹500 for a clean race test.
    await Wallet.updateOne({ userId: testUserId, orgId: testOrgId }, { $set: { balance: 500 } });

    // Concurrently fire two separate debits of ₹500
    const [result1, result2] = await Promise.allSettled([
      walletService.debitWallet({
        userId: testUserId,
        orgId: testOrgId,
        amount: 500,
        description: 'Race debit request A',
      }),
      walletService.debitWallet({
        userId: testUserId,
        orgId: testOrgId,
        amount: 500,
        description: 'Race debit request B',
      }),
    ]);

    // Exactly one must succeed, and the other must fail with 400 Insufficient balance
    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');
    const failures = [result1, result2].filter((r) => r.status === 'rejected');

    assert.equal(successes.length, 1, 'Exactly one concurrent debit must succeed');
    assert.equal(failures.length, 1, 'Second concurrent debit must be rejected');
    assert.equal(failures[0].reason.statusCode, 400);
    assert.ok(failures[0].reason.message.includes('Insufficient wallet balance'));

    // Verify wallet balance is 0 and NEVER negative (no overdraft!)
    const finalWallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(finalWallet.balance, 0, 'Wallet balance must be 0, never negative');
  });

  test('Test 2.4 — Concurrent Credits: simultaneous valid credits both succeed and accumulate balance', async () => {
    // Reset balance to 0 first to guarantee clean starting state
    await Wallet.updateOne({ userId: testUserId, orgId: testOrgId }, { $set: { balance: 0 } });

    const [creditRes1, creditRes2] = await Promise.all([
      walletService.creditWallet({
        userId: testUserId,
        orgId: testOrgId,
        amount: 300,
        description: 'Concurrent credit 1',
      }),
      walletService.creditWallet({
        userId: testUserId,
        orgId: testOrgId,
        amount: 700,
        description: 'Concurrent credit 2',
      }),
    ]);

    assert.equal(creditRes1.transaction.type, 'Credit');
    assert.equal(creditRes2.transaction.type, 'Credit');

    const wallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(wallet.balance, 1000, 'Both concurrent credits must accumulate to ₹1,000');
  });

  // --------------------------------------------------------------------------
  // Group 3: Settlement Engine + Ledger Integration
  // --------------------------------------------------------------------------

  test('Test 3.1 — Invoice Settlement + Ledger: invoice payment records balanced ledger entry', async () => {
    const invoice = await createTestInvoice({
      totalDue: 1200,
      totalAmount: 1200,
      paidAmount: 0,
      outstandingAmount: 1200,
      status: 'UNPAID',
    });

    const context = PaymentContextFactory.fromInvoice(invoice, { amount: 1200 });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    const razorpayPaymentId = `pay_inv_ledger_${Date.now()}`;
    const result = await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: 'sig_mock_p4',
    });

    assert.equal(result.success, true);
    assert.ok(result.settlement.ledgerEntry, 'Settlement must return created ledgerEntry');

    // Inspect created FinancialLedgerEntry
    const ledger = await financialLedgerRepository.findByPaymentId(order.paymentId);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].domain, 'INVOICE');
    assert.equal(ledger[0].amount, 1200);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger[0].status, LEDGER_STATUSES.POSTED);
  });

  test('Test 3.2 — Amenity Settlement + Ledger: amenity booking records balanced ledger entry', async () => {
    const booking = await createTestBooking({
      totalAmount: 600,
    });

    const context = PaymentContextFactory.fromAmenityBooking(booking, { amount: 600 });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    const razorpayPaymentId = `pay_amenity_ledger_${Date.now()}`;
    const result = await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: 'sig_mock_p4',
    });

    assert.equal(result.success, true);

    const ledger = await financialLedgerRepository.findByPaymentId(order.paymentId);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].domain, 'AMENITY');
    assert.equal(ledger[0].amount, 600);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.AMENITY_REVENUE);
  });

  test('Test 3.3 — Wallet Recharge Settlement + Ledger: recharge records double-entry to RESIDENT_WALLET', async () => {
    const context = PaymentContextFactory.forWalletRecharge({
      userId: testUserId,
      orgId: testOrgId,
      amount: 1500,
    });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });

    const razorpayPaymentId = `pay_recharge_ledger_${Date.now()}`;
    const result = await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: 'sig_mock_p4',
    });

    assert.equal(result.success, true);

    const ledger = await financialLedgerRepository.findByPaymentId(order.paymentId);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].domain, 'WALLET');
    assert.equal(ledger[0].amount, 1500);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.RESIDENT_WALLET);
  });

  test('Test 3.4 — Wallet Spend on Invoice + Ledger: payInvoiceWithWallet records double-entry', async () => {
    // Seed wallet balance to ₹2,000
    await Wallet.updateOne({ userId: testUserId, orgId: testOrgId }, { $set: { balance: 2000 } });

    const invoice = await createTestInvoice({
      totalDue: 800,
      totalAmount: 800,
      paidAmount: 0,
      outstandingAmount: 800,
      status: 'UNPAID',
    });

    const payResult = await walletService.payInvoiceWithWallet(testUserId, invoice._id, 800, testOrgId);
    assert.equal(payResult.success, true);
    assert.equal(payResult.walletBalance, 1200);

    const ledgers = await financialLedgerRepository.findByReference('Invoice', invoice._id);
    assert.ok(ledgers.length >= 1);
    const ledger = ledgers[0];
    assert.equal(ledger.amount, 800);
    assert.equal(ledger.debitAccount, FINANCIAL_ACCOUNTS.RESIDENT_WALLET);
    assert.equal(ledger.creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
  });

  test('Test 3.5 — Refund Settlement + Compensating Ledger Entry', async () => {
    // 1. Create and settle an invoice payment
    const invoice = await createTestInvoice({
      totalDue: 500,
      totalAmount: 500,
      status: 'UNPAID',
    });
    const context = PaymentContextFactory.fromInvoice(invoice, { amount: 500 });
    const order = await unifiedPaymentService.createPaymentOrder(context, { gateway: 'razorpay' });
    const rzpId = `pay_ref_src_${Date.now()}`;
    await unifiedPaymentService.verifyPayment({
      paymentId: order.paymentId,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: rzpId,
      razorpay_signature: 'sig_mock_p4',
    });

    // 2. Process refund
    const refundResult = await unifiedPaymentService.processRefund(order.paymentId, 500, 'Customer requested refund');
    assert.equal(refundResult.success, true);

    // 3. Verify compensating ledger entry
    const ledgers = await financialLedgerRepository.findByPaymentId(order.paymentId);
    assert.equal(ledgers.length, 2, 'Must have 1 settlement ledger and 1 refund ledger');

    const refundLedger = ledgers.find((l) => l.domain === 'REFUND');
    assert.ok(refundLedger, 'Compensating refund ledger must exist');
    assert.equal(refundLedger.amount, 500);
    assert.equal(refundLedger.debitAccount, FINANCIAL_ACCOUNTS.REVENUE_ADJUSTMENT);
    assert.equal(refundLedger.creditAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
  });

  // --------------------------------------------------------------------------
  // Group 4: Failure Rollback & Transaction Boundary
  // --------------------------------------------------------------------------

  test('Test 4.1 — Failure Rollback: simulated ledger failure in debitWallet rolls back wallet balance', async () => {
    // Set wallet balance to ₹1,000
    await Wallet.updateOne({ userId: testUserId, orgId: testOrgId }, { $set: { balance: 1000 } });

    // Intentionally pass an invalid amount causing double-entry validation to reject
    const session = await mongoose.startSession();
    session.startTransaction();

    let threw = false;
    try {
      // Create a scenario where debit occurs but ledger recording triggers error
      await walletRepository.atomicDebit(testUserId, testOrgId, 300, session);

      // Trigger intentional ledger failure inside this session
      const invalidLedger = new FinancialLedgerEntry({
        transactionId: `FAIL-${Date.now()}`,
        orgId: testOrgId,
        domain: 'INVOICE',
        referenceType: 'Invoice',
        referenceId: new mongoose.Types.ObjectId(),
        debitAccount: FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING,
        creditAccount: FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE,
        amount: -50, // Invalid negative amount
        idempotencyKey: `fail_${Date.now()}`,
      });
      await invalidLedger.save({ session });
      await session.commitTransaction();
    } catch (err) {
      threw = true;
      await session.abortTransaction();
    } finally {
      session.endSession();
    }

    assert.equal(threw, true, 'Ledger failure must trigger exception and abort');

    // Balance must be untouched at ₹1,000
    const wallet = await walletService.getWallet(testUserId, testOrgId);
    assert.equal(wallet.balance, 1000, 'Wallet balance must be completely rolled back');
  });

  // --------------------------------------------------------------------------
  // Group 5: Tenant Isolation & Security
  // --------------------------------------------------------------------------

  test('Test 5.1 — Tenant Isolation: financial history query for otherOrgId returns 0 records of testOrgId', async () => {
    const historyOther = await financialLedgerService.getFinancialHistory(otherOrgId);
    assert.equal(historyOther.entries.length, 0, 'Foreign community must have 0 records');

    const historyTest = await financialLedgerService.getFinancialHistory(testOrgId);
    assert.ok(historyTest.entries.length > 0, 'Primary community must have entries');

    // Ensure all records in historyTest belong to testOrgId
    for (const entry of historyTest.entries) {
      assert.equal(entry.orgId.toString(), testOrgId.toString());
    }
  });

  test('Test 5.2 — Amount Tampering: debit or credit with zero or negative amounts is rejected', async () => {
    await assert.rejects(
      async () => {
        await walletService.debitWallet({
          userId: testUserId,
          orgId: testOrgId,
          amount: -100,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await walletService.creditWallet({
          userId: testUserId,
          orgId: testOrgId,
          amount: 0,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Group 6: Diagnostic & Consistency Checks (Reconciliation Auditor)
  // --------------------------------------------------------------------------

  test('Test 6.1 — Reconciliation Auditor: detects unledgered payments or reports clean status', async () => {
    const report = await financialLedgerService.checkReconciliation(testOrgId);
    assert.ok(report);
    assert.equal(report.orgId, testOrgId.toString());
    assert.equal(Array.isArray(report.paymentsWithoutLedger), true);
    assert.equal(Array.isArray(report.walletTransactionsWithoutLedger), true);
    assert.equal(Array.isArray(report.divergentWalletBalances), true);
    assert.equal(typeof report.isClean, 'boolean');
  });
});
