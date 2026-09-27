/**
 * NAHOM — Unified Financial Architecture
 * Phase 8 Test Suite: Deprecation + Cleanup + Production Hardening
 *
 * Validates:
 * 1. Canonical Payment & Double-Entry Settlement Pipeline (Invoice payment -> Ledger zero imbalance)
 * 2. Legacy Model Write-Protection & Historical Immutability (WalletLedger and Ledger save/update/delete blocked)
 * 3. Historical Audit Query Preservation (Deprecated collections remain queryable in read-only mode)
 * 4. High-Concurrency Wallet Race Condition Defense (10 simultaneous debits against bounded balance)
 * 5. Webhook Replay Idempotency & Duplicate Settlement Prevention
 * 6. Multi-Tenant Financial Boundary Isolation
 * 7. Production Financial Integrity Auditor (financialIntegrityService returns PASS)
 * 8. Real-Time Operational Financial Metrics (financialMetricsService zero-imbalance validation)
 * 9. Financial Feature Flags System & Canonical Defaults
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
import Payment from '../src/features/payment/payment.model.js';
import { Wallet, WalletTransaction } from '../src/features/wallet/wallet.model.js';
import WalletLedger from '../src/features/wallet/walletLedger.model.js';
import Ledger from '../src/features/ledger/ledger.model.js';

import {
  FinancialLedgerEntry,
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
} from '../src/features/ledger/index.js';

import walletService from '../src/features/wallet/wallet.service.js';
import walletRepository from '../src/features/wallet/wallet.repository.js';
import integrationHubService from '../src/features/integrationHub/integrationHub.service.js';
import {
  unifiedPaymentService,
  paymentSettlementService,
  PaymentContextFactory,
  PAYMENT_DOMAINS,
  CANONICAL_PAYMENT_METHODS,
  CANONICAL_PAYMENT_STATUSES,
} from '../src/features/payment/index.js';
import { PaymentContext } from '../src/features/payment/payment.types.js';

import financialIntegrityService from '../src/features/ledger/financialIntegrity.service.js';
import financialMetricsService from '../src/features/ledger/financialMetrics.service.js';
import { financialFeatureFlags } from '../src/config/financialFeatureFlags.js';

dotenv.config();
process.env.NODE_ENV = 'test';

describe('Phase 8: Deprecation + Cleanup + Production Hardening', () => {
  let testOrgA;
  let testOrgB;
  let residentUserA;
  let residentUserB;
  let httpServer;

  async function createTestUser({ name, email, orgId, role = 'resident' }) {
    const [first, ...rest] = name.split(' ');
    const last = rest.join(' ') || 'User';
    const uname = `u_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    return await User.create({
      name,
      firstName: first,
      lastName: last,
      username: uname,
      password: 'Password123!',
      email: email || `${uname}@example.com`,
      userRole: role,
      role: role === 'admin' ? 'Admin' : 'Resident',
      orgId,
      status: 'Active',
    });
  }

  before(async () => {
    await connectToDb();
    httpServer = http.createServer();
    await initSocket(httpServer);

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    testOrgA = await Organization.create({
      name: `Phase 8 Org Alpha ${suffix}`,
      code: `P8A_${suffix}`,
      organizationType: 'Residential',
      status: 'Active',
      address: { street: '100 Alpha Way', city: 'Bangalore', state: 'KA', zip: '560001' },
    });

    testOrgB = await Organization.create({
      name: `Phase 8 Org Beta ${suffix}`,
      code: `P8B_${suffix}`,
      organizationType: 'Residential',
      status: 'Active',
      address: { street: '200 Beta Way', city: 'Bangalore', state: 'KA', zip: '560001' },
    });

    residentUserA = await createTestUser({
      name: `Resident Alpha ${suffix}`,
      email: `resident.a.${suffix}@example.com`,
      role: 'resident',
      orgId: testOrgA._id,
    });

    residentUserB = await createTestUser({
      name: `Resident Beta ${suffix}`,
      email: `resident.b.${suffix}@example.com`,
      role: 'resident',
      orgId: testOrgB._id,
    });

    await integrationHubService.connect(
      residentUserA._id,
      testOrgA._id,
      'razorpay',
      'Phase 8 Razorpay Gateway',
      {
        keyId: 'rzp_test_p8_1234567890',
        keySecret: 'sec_test_p8_keysecret1234',
      }
    );
  });

  after(async () => {
    try {
      const orgIds = [testOrgA?._id, testOrgB?._id].filter(Boolean);
      await Payment.deleteMany({ orgId: { $in: orgIds } });
      await FinancialLedgerEntry.deleteMany({ orgId: { $in: orgIds } });
      await Wallet.deleteMany({ orgId: { $in: orgIds } });
      await WalletTransaction.deleteMany({ orgId: { $in: orgIds } });
      await Invoice.deleteMany({ orgId: { $in: orgIds } });
      await User.deleteMany({ _id: { $in: [residentUserA?._id, residentUserB?._id].filter(Boolean) } });
      await Organization.deleteMany({ _id: { $in: orgIds } });
    } catch {
      // Ignore teardown errors
    } finally {
      if (httpServer) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await mongoose.disconnect();
    }
  });

  test('8.1 Canonical Pipeline: Invoice Payment -> Settlement -> Double-Entry Balanced Ledger', async () => {
    // 1. Create Invoice
    const invoice = await Invoice.create({
      orgId: testOrgA._id,
      communityId: testOrgA._id,
      assessmentId: new mongoose.Types.ObjectId(),
      targetUserId: residentUserA._id,
      unitId: new mongoose.Types.ObjectId(),
      billingPeriodString: '2026-09',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      invoiceNumber: `INV-P8-${Date.now()}`,
      currentCharge: 2500,
      totalAmount: 2500,
      totalDue: 2500,
      paidAmount: 0,
      outstandingAmount: 2500,
      status: 'UNPAID',
    });

    // 2. Build Canonical Payment Context
    const paymentContext = PaymentContextFactory.fromInvoice(invoice, {
      amount: 2500,
      userId: residentUserA._id,
      orgId: testOrgA._id,
    });

    // 3. Initiate Payment Order
    const orderResult = await unifiedPaymentService.createPaymentOrder(paymentContext);
    assert.ok(orderResult);
    assert.equal(orderResult.success, true);
    assert.equal(orderResult.amount, 2500);

    const paymentRecord = await Payment.findById(orderResult.paymentId);
    assert.ok(paymentRecord);
    assert.equal(paymentRecord.status, 'pending');

    // 4. Atomic Settlement via Verification
    const mockRzpPaymentId = `pay_p8_${Date.now()}`;
    const verifyResult = await unifiedPaymentService.verifyPayment({
      orgId: testOrgA._id,
      paymentId: orderResult.paymentId,
      orderId: orderResult.orderId,
      razorpayPaymentId: mockRzpPaymentId,
      razorpaySignature: 'sig_mock_signature_test',
    });

    assert.ok(verifyResult);
    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.settlement.payment.status, 'success');

    // 5. Verify Invoice State
    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.paidAmount, 2500);
    assert.equal(updatedInvoice.outstandingAmount, 0);

    // 6. Verify Double-Entry Ledger Invariants
    const ledgerEntries = await FinancialLedgerEntry.find({ paymentId: orderResult.paymentId });
    assert.equal(ledgerEntries.length, 1, 'Must create exactly 1 balanced double-entry transaction');

    const entry = ledgerEntries[0];
    assert.equal(entry.status, LEDGER_STATUSES.POSTED);
    assert.equal(entry.amount, 2500);

    const debits = entry.entries.filter((e) => e.entryType === ENTRY_TYPES.DEBIT).reduce((s, e) => s + e.amount, 0);
    const credits = entry.entries.filter((e) => e.entryType === ENTRY_TYPES.CREDIT).reduce((s, e) => s + e.amount, 0);
    assert.equal(debits, 2500);
    assert.equal(credits, 2500);
    assert.equal(Math.abs(debits - credits), 0, 'Zero imbalance invariant');
  });

  test('8.2 Legacy Model Write-Protection: WalletLedger rejects all writes with deprecation error', async () => {
    // Attempting to save new WalletLedger document MUST be rejected
    await assert.rejects(
      async () => {
        await WalletLedger.create({
          userId: residentUserA._id,
          amount: 500,
          transactionType: 'credit',
          description: 'Deprecated write attempt',
        });
      },
      (err) => {
        assert.ok(
          err.message.includes('WalletLedger is deprecated'),
          `Expected deprecation message, got: ${err.message}`
        );
        return true;
      }
    );
  });

  test('8.3 Legacy Model Write-Protection: Ledger rejects save, update, and delete mutations', async () => {
    // 1. Attempting to save new Ledger document MUST be rejected
    await assert.rejects(
      async () => {
        await Ledger.create({
          orgId: testOrgA._id,
          userId: residentUserA._id,
          type: 'credit',
          amount: 1000,
          balanceAfter: 1000,
          description: 'Deprecated ledger write attempt',
        });
      },
      (err) => {
        assert.ok(
          err.message.includes('Ledger is deprecated'),
          `Expected deprecation message, got: ${err.message}`
        );
        return true;
      }
    );

    // 2. Attempting to update MUST be rejected
    await assert.rejects(
      async () => {
        await Ledger.updateOne({ orgId: testOrgA._id }, { $set: { amount: 999 } });
      },
      (err) => {
        assert.ok(
          err.message.includes('Ledger is deprecated. Updates are strictly forbidden'),
          `Expected update rejection, got: ${err.message}`
        );
        return true;
      }
    );

    // 3. Attempting to delete MUST be rejected
    await assert.rejects(
      async () => {
        await Ledger.deleteOne({ orgId: testOrgA._id });
      },
      (err) => {
        assert.ok(
          err.message.includes('Ledger is deprecated. Deletions are strictly forbidden'),
          `Expected delete rejection, got: ${err.message}`
        );
        return true;
      }
    );
  });

  test('8.4 Historical Audit Query Preservation: Deprecated collections remain readable', async () => {
    // Read operations must not throw
    const walletLedgerResults = await WalletLedger.find({ userId: residentUserA._id }).lean();
    assert.ok(Array.isArray(walletLedgerResults), 'WalletLedger read must return array');

    const ledgerResults = await Ledger.find({ orgId: testOrgA._id }).lean();
    assert.ok(Array.isArray(ledgerResults), 'Ledger read must return array');
  });

  test('8.5 High-Concurrency Hardening: 10 concurrent debits cannot overdraft or cause negative balance', async () => {
    const testUser = await createTestUser({
      name: 'Concurrency Tester',
      email: `conc_${Date.now()}@example.com`,
      orgId: testOrgA._id,
    });

    // Seed wallet with ₹200
    await walletRepository.updateBalance(testUser._id, testOrgA._id, 200);

    // Launch 10 simultaneous debit requests of ₹60 each
    // Exactly 3 can succeed (3 * 60 = 180 <= 200, remainder 20). 7 must fail.
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        walletService.debitWallet({
          userId: testUser._id,
          orgId: testOrgA._id,
          amount: 60,
          description: `Concurrent debit ${i}`,
        })
      )
    );

    const successfulDebits = results.filter((r) => r.status === 'fulfilled');
    const failedDebits = results.filter((r) => r.status === 'rejected');

    assert.equal(successfulDebits.length, 3, 'Exactly 3 debits of ₹60 can fit into ₹200');
    assert.equal(failedDebits.length, 7, 'Exactly 7 debits must fail with insufficient funds');

    const finalWallet = await walletRepository.getWallet(testUser._id, testOrgA._id);
    assert.equal(finalWallet.balance, 20, 'Final balance must be exactly ₹20');
    assert.ok(finalWallet.balance >= 0, 'Wallet balance MUST never be negative');
  });

  test('8.6 Webhook Replay & Idempotency: Duplicate settlement returns alreadySettled and avoids double-credit', async () => {
    // 1. Create a fresh payment in pending status
    const payment = await Payment.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      domain: PAYMENT_DOMAINS.WALLET,
      referenceType: 'WalletRecharge',
      referenceId: new mongoose.Types.ObjectId(),
      amount: 1000,
      currency: 'INR',
      status: 'pending',
      paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
      gateway: 'razorpay',
      idempotencyKey: `REPLAY-TEST-${Date.now()}`,
    });

    // Create wallet for residentUserA if none
    let wallet = await Wallet.findOne({ userId: residentUserA._id, orgId: testOrgA._id });
    if (!wallet) {
      wallet = await Wallet.create({
        orgId: testOrgA._id,
        userId: residentUserA._id,
        balance: 0,
        currency: 'INR',
        status: 'active',
      });
    }
    const initialBalance = wallet.balance;

    // 2. First Settlement Call
    const gatewayTransactionId = `pay_replay_${Date.now()}`;
    const result1 = await paymentSettlementService.settlePayment({
      paymentId: payment._id,
      gatewayTransactionId,
      paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
    });
    assert.equal(result1.success, true);
    assert.equal(result1.alreadySettled, false);

    const walletAfterFirst = await Wallet.findById(wallet._id);
    assert.equal(walletAfterFirst.balance, initialBalance + 1000);

    const ledgerCount1 = await FinancialLedgerEntry.countDocuments({ paymentId: payment._id });
    assert.equal(ledgerCount1, 1, 'Initial settlement posts exactly 1 balanced ledger transaction');

    // 3. Second Settlement Call (Duplicate / Replay)
    const result2 = await paymentSettlementService.settlePayment({
      paymentId: payment._id,
      gatewayTransactionId,
      paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
    });
    assert.equal(result2.success, true);
    assert.equal(result2.alreadySettled, true, 'Replay must detect existing settlement');

    // Verify wallet balance was NOT credited twice
    const walletAfterSecond = await Wallet.findById(wallet._id);
    assert.equal(walletAfterSecond.balance, initialBalance + 1000, 'Balance must remain identical on replay');

    // Verify ledger entries were NOT duplicated
    const ledgerCount2 = await FinancialLedgerEntry.countDocuments({ paymentId: payment._id });
    assert.equal(ledgerCount2, 1, 'Ledger entries must not be duplicated on replay');
  });

  test('8.7 Multi-Tenant Isolation: Cross-tenant payment request is strictly forbidden', async () => {
    // Invoice belongs to Org B
    const foreignInvoice = await Invoice.create({
      orgId: testOrgB._id,
      communityId: testOrgB._id,
      assessmentId: new mongoose.Types.ObjectId(),
      targetUserId: residentUserB._id,
      unitId: new mongoose.Types.ObjectId(),
      billingPeriodString: '2026-09',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      invoiceNumber: `INV-FOREIGN-${Date.now()}`,
      currentCharge: 3000,
      totalAmount: 3000,
      totalDue: 3000,
      paidAmount: 0,
      outstandingAmount: 3000,
      status: 'UNPAID',
    });

    // Resident A in Org A attempts to pay Org B invoice
    const crossTenantContext = new PaymentContext({
      domain: PAYMENT_DOMAINS.INVOICE,
      referenceId: foreignInvoice._id.toString(),
      referenceType: 'Invoice',
      orgId: testOrgA._id.toString(), // Client claims Org A, but invoice belongs to Org B
      userId: residentUserA._id.toString(),
      amount: 3000,
    });

    await assert.rejects(
      async () => {
        await unifiedPaymentService.createPaymentOrder(crossTenantContext);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Cross-tenant payment forbidden/i);
        return true;
      }
    );
  });

  test('8.8 Production Financial Integrity Auditor: Returns PASS for consistent state', async () => {
    const report = await financialIntegrityService.runIntegrityCheck(testOrgA._id);

    assert.equal(report.status, 'PASS', 'Overall integrity check must PASS');
    assert.equal(report.suites.Payments, 'PASS');
    assert.equal(report.suites.Wallets, 'PASS');
    assert.equal(report.suites.WalletTransactions, 'PASS');
    assert.equal(report.suites.Ledger, 'PASS');
    assert.equal(report.suites.Invoices, 'PASS');
    assert.equal(report.suites.Reconciliation, 'PASS');
    assert.equal(report.suites.TenantIsolation, 'PASS');
    assert.equal(report.summary.failedChecks, 0);
  });

  test('8.9 Operational Financial Metrics: Verifies zero-imbalance, circulating wallet volume, and feature flags', async () => {
    const metrics = await financialMetricsService.getMetrics(testOrgA._id);

    assert.ok(metrics.timestamp);
    assert.equal(metrics.overallStatus, 'HEALTHY');
    assert.ok(metrics.payments.total >= 1);
    assert.ok(metrics.payments.success >= 1);
    assert.equal(metrics.ledger.imbalance, 0, 'Double-entry ledger imbalance must be exactly 0');
    assert.equal(metrics.ledger.isBalanced, true);
    assert.equal(metrics.wallets.negativeBalanceCount, 0, 'No wallet may have negative balance');
    assert.equal(metrics.legacyStorage.writeProtectionEnforced, true);
    assert.equal(metrics.featureFlags.UNIFIED_PAYMENT_CORE_ENABLED, true);
    assert.equal(metrics.featureFlags.LEGACY_PAYMENT_PATH_ENABLED, false);
  });

  test('8.10 Canonical Feature Flags System: Environment variable overrides operate correctly', async () => {
    assert.equal(financialFeatureFlags.isEnabled('UNIFIED_PAYMENT_CORE_ENABLED'), true);
    assert.equal(financialFeatureFlags.isEnabled('UNIFIED_LEDGER_ENABLED'), true);
    assert.equal(financialFeatureFlags.isEnabled('LEGACY_PAYMENT_PATH_ENABLED'), false);
    assert.equal(financialFeatureFlags.isEnabled('LEGACY_WEBHOOK_ENABLED'), true);

    const allFlags = financialFeatureFlags.getAll();
    assert.ok('UNIFIED_PAYMENT_CORE_ENABLED' in allFlags);
    assert.ok('LEGACY_PAYMENT_PATH_ENABLED' in allFlags);
    assert.ok('HISTORICAL_RECONCILIATION_ENABLED' in allFlags);
    assert.ok('GENESIS_LEDGER_ENABLED' in allFlags);
  });
});
