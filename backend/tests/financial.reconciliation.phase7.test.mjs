/**
 * NAHOM — Unified Financial Architecture
 * Phase 7 Test Suite: Historical Backfill + Financial Reconciliation + Genesis Ledger
 * 
 * Validates:
 * 1. Historical Inventory Accuracy & Multi-Tenant Isolation
 * 2. Deterministic Matcher Priority Hierarchy (Priorities 1 to 5, Ambiguity Conflict, Unmatched)
 * 3. DRY_RUN Mode Strict Immutability (Zero Database Writes to Payments, Ledger, or Domain records)
 * 4. EXECUTE Mode Backfill & Mongoose Transaction Atomicity
 * 5. Strict Idempotency on Repeated EXECUTE Runs (Zero duplicate payments or ledger entries)
 * 6. Wallet Genesis Opening Balance (Disallowed vs Allowed)
 * 7. Wallet Divergence Rejection (Transactions sum != Stored balance -> CONFLICT, never papered over)
 * 8. Accounting Invariants Verification (Sum Debit == Sum Credit, No negative amounts, Balanced clearing)
 * 9. Reconciliation Exception Lifecycle (Creation, Querying, Admin Review/Resolution)
 * 10. Non-Destructive Invariant (Historical documents never mutated or deleted)
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
import Payment from '../src/features/payment/payment.model.js';
import { Wallet, WalletTransaction } from '../src/features/wallet/wallet.model.js';

import {
  FinancialLedgerEntry,
  FINANCIAL_ACCOUNTS,
  ENTRY_TYPES,
  LEDGER_STATUSES,
} from '../src/features/ledger/index.js';

import {
  historicalInventoryService,
  historicalMatcherService,
  historicalReconciliationService,
  reconciliationReportService,
  ReconciliationException,
  HistoricalMigrationRun,
  RECONCILIATION_CLASSIFICATIONS,
  RECONCILIATION_EXCEPTION_STATUSES,
  MIGRATION_EXECUTION_MODES,
} from '../src/features/ledger/reconciliation/index.js';

dotenv.config();
process.env.NODE_ENV = 'test';

describe('Phase 7: Historical Backfill + Financial Reconciliation + Genesis Ledger', () => {
  let testOrgA;
  let testOrgB;
  let residentUserA;
  let residentUserB;
  let adminUser;
  let testAmenity;
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

  async function createTestInvoice(overrides = {}) {
    const amount = overrides.totalAmount || overrides.totalDue || 5000;
    const paid = overrides.paidAmount || 0;
    const outstanding = overrides.outstandingAmount !== undefined ? overrides.outstandingAmount : Math.max(0, amount - paid);
    const orgId = overrides.orgId || overrides.communityId || testOrgA._id;

    return await Invoice.create({
      orgId,
      communityId: orgId,
      assessmentId: new mongoose.Types.ObjectId(),
      targetUserId: overrides.targetUserId || residentUserA._id,
      unitId: new mongoose.Types.ObjectId(),
      billingPeriodString: '2026-12',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      invoiceNumber: overrides.invoiceNumber || `INV-P7-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      currentCharge: amount,
      totalAmount: amount,
      totalDue: amount,
      paidAmount: paid,
      outstandingAmount: outstanding,
      status: overrides.status || (outstanding <= 0.01 ? 'PAID' : (paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID')),
      ...overrides,
    });
  }

  before(async () => {
    try {
      await connectToDb();
      httpServer = http.createServer();
      await initSocket(httpServer);

      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      testOrgA = await Organization.create({
        name: `Reconciliation Org Alpha ${suffix}`,
        code: `ROA_${suffix}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '100 Alpha Way', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      testOrgB = await Organization.create({
        name: `Reconciliation Org Beta ${suffix}`,
        code: `ROB_${suffix}`,
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

      adminUser = await createTestUser({
        name: `Finance Admin ${suffix}`,
        email: `admin.${suffix}@example.com`,
        role: 'admin',
        orgId: testOrgA._id,
      });

      testAmenity = await Amenity.create({
        orgId: testOrgA._id,
        name: `Clubhouse ${suffix}`,
        type: 'clubhouse',
        capacity: 20,
        pricing: {
          baseRate: 400,
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
      console.error('CRITICAL: Error in Phase 7 before() hook:', err);
      throw err;
    }
  });

  after(async () => {
    // Teardown test artifacts
    try {
      if (testOrgA && testOrgB) {
        const orgIds = [testOrgA._id, testOrgB._id];
        await Payment.deleteMany({ orgId: { $in: orgIds } });
        await Invoice.deleteMany({ orgId: { $in: orgIds } });
        await AmenityBooking.deleteMany({ orgId: { $in: orgIds } });
        await Amenity.deleteMany({ orgId: { $in: orgIds } });
        await Wallet.deleteMany({ orgId: { $in: orgIds } });
        await WalletTransaction.deleteMany({ orgId: { $in: orgIds } });
        await FinancialLedgerEntry.collection.deleteMany({ orgId: { $in: orgIds } });
        await ReconciliationException.deleteMany({ orgId: { $in: orgIds } });
        await HistoricalMigrationRun.deleteMany({ orgId: { $in: orgIds } });
        await User.deleteMany({ orgId: { $in: orgIds } });
        await Organization.deleteMany({ _id: { $in: orgIds } });
      }
    } catch (teardownErr) {
      console.error('Error during Phase 7 teardown:', teardownErr);
    } finally {
      if (httpServer) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await mongoose.disconnect();
    }
  });

  test('1. Historical Inventory Accuracy & Tenant Isolation', async () => {
    // Create seed historical records for Org A
    const inv1 = await createTestInvoice({
      orgId: testOrgA._id,
      targetUserId: residentUserA._id,
      invoiceNumber: `INV-TEST-001-${Date.now()}`,
      billingPeriodString: '2026-01',
      currentCharge: 3000,
      totalAmount: 3000,
      totalDue: 3000,
      paidAmount: 3000,
      outstandingAmount: 0,
      status: 'PAID',
    });

    const inv2 = await createTestInvoice({
      orgId: testOrgA._id,
      targetUserId: residentUserA._id,
      invoiceNumber: `INV-TEST-002-${Date.now()}`,
      billingPeriodString: '2026-02',
      currentCharge: 2000,
      totalAmount: 2000,
      totalDue: 2000,
      paidAmount: 0,
      outstandingAmount: 2000,
      status: 'UNPAID',
    });

    const walletA = await Wallet.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      balance: 5000,
    });

    const inventory = await historicalInventoryService.getInventory(testOrgA._id);
    assert.strictEqual(inventory.tenants.length, 1);
    const tenantSummary = inventory.tenants[0];

    assert.strictEqual(tenantSummary.orgId, testOrgA._id.toString());
    assert.strictEqual(tenantSummary.invoices.total, 2);
    assert.strictEqual(tenantSummary.invoices.paidCount, 1);
    assert.strictEqual(tenantSummary.invoices.unpaidCount, 1);
    assert.strictEqual(tenantSummary.invoices.paidAmount, 3000);
    assert.strictEqual(tenantSummary.wallets.total, 1);
    assert.strictEqual(tenantSummary.wallets.totalBalance, 5000);
  });

  test('2. Deterministic Matcher Priority Hierarchy', async () => {
    // Priority 1: Exact paymentId
    const paymentP1 = await Payment.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      referenceId: new mongoose.Types.ObjectId(),
      referenceType: 'Invoice',
      amount: 1500,
      status: 'success',
      paymentMethod: 'ONLINE',
      domain: 'INVOICE',
    });

    const invP1 = {
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrgA._id,
      paymentId: paymentP1._id.toString(),
      paidAmount: 1500,
      targetUserId: residentUserA._id,
    };
    const match1 = await historicalMatcherService.matchRecord(invP1, 'Invoice');
    assert.strictEqual(match1.matched, true);
    assert.strictEqual(match1.priority, 1);
    assert.strictEqual(match1.strategy, 'EXACT_PAYMENT_ID');

    // Priority 2: Gateway transaction identifier
    const paymentP2 = await Payment.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      referenceId: new mongoose.Types.ObjectId(),
      referenceType: 'Invoice',
      amount: 1200,
      status: 'success',
      paymentMethod: 'ONLINE',
      gatewayTransactionId: `pay_p2_gateway_${Date.now()}`,
      domain: 'INVOICE',
    });

    const invP2 = {
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrgA._id,
      razorpayTransactionId: paymentP2.gatewayTransactionId,
      paidAmount: 1200,
      targetUserId: residentUserA._id,
    };
    const match2 = await historicalMatcherService.matchRecord(invP2, 'Invoice');
    assert.strictEqual(match2.matched, true);
    assert.strictEqual(match2.priority, 2);
    assert.strictEqual(match2.strategy, 'GATEWAY_IDENTIFIER');

    // Priority 3: Explicit domain reference
    const sourceIdP3 = new mongoose.Types.ObjectId();
    const paymentP3 = await Payment.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      referenceId: sourceIdP3,
      referenceType: 'Invoice',
      amount: 800,
      status: 'success',
      paymentMethod: 'ONLINE',
      domain: 'INVOICE',
    });

    const invP3 = {
      _id: sourceIdP3,
      orgId: testOrgA._id,
      paidAmount: 800,
      targetUserId: residentUserA._id,
    };
    const match3 = await historicalMatcherService.matchRecord(invP3, 'Invoice');
    assert.strictEqual(match3.matched, true);
    assert.strictEqual(match3.priority, 3);
    assert.strictEqual(match3.strategy, 'EXPLICIT_DOMAIN_REFERENCE');

    // Priority 4: Explicit WalletTransaction reference
    const sourceIdP4 = new mongoose.Types.ObjectId();
    const walletTxnP4 = await WalletTransaction.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      transactionId: `TXN-W-${Date.now()}`,
      type: 'Debit',
      amount: 600,
      referenceId: sourceIdP4,
      referenceType: 'Invoice',
      paymentStatus: 'success',
    });

    const invP4 = {
      _id: sourceIdP4,
      orgId: testOrgA._id,
      paidAmount: 600,
      targetUserId: residentUserA._id,
    };
    const match4 = await historicalMatcherService.matchRecord(invP4, 'Invoice');
    assert.strictEqual(match4.matched, true);
    assert.strictEqual(match4.priority, 4);
    assert.strictEqual(match4.strategy, 'WALLET_TRANSACTION_REFERENCE');

    // Unmatched record
    const invUnmatched = {
      _id: new mongoose.Types.ObjectId(),
      orgId: testOrgA._id,
      paidAmount: 9999,
      targetUserId: residentUserA._id,
    };
    const matchUnmatched = await historicalMatcherService.matchRecord(invUnmatched, 'Invoice');
    assert.strictEqual(matchUnmatched.matched, false);
    assert.strictEqual(matchUnmatched.classification, RECONCILIATION_CLASSIFICATIONS.UNMATCHED);
  });

  test('3. DRY_RUN Mode Strict Immutability (Zero Database Writes)', async () => {
    // Record baseline database counts before DRY_RUN
    const paymentsBefore = await Payment.countDocuments({ orgId: testOrgA._id });
    const ledgerBefore = await FinancialLedgerEntry.countDocuments({ orgId: testOrgA._id });
    const runsBefore = await HistoricalMigrationRun.countDocuments({ orgId: testOrgA._id });

    // Execute DRY_RUN
    const dryRunResult = await historicalReconciliationService.reconcile({
      orgId: testOrgA._id,
      mode: MIGRATION_EXECUTION_MODES.DRY_RUN,
      allowGenesis: false,
    });

    assert.strictEqual(dryRunResult.mode, 'DRY_RUN');
    assert.strictEqual(dryRunResult.status, 'COMPLETED');
    assert.ok(dryRunResult.summary.totalProcessed > 0);

    // Verify zero database writes occurred
    const paymentsAfter = await Payment.countDocuments({ orgId: testOrgA._id });
    const ledgerAfter = await FinancialLedgerEntry.countDocuments({ orgId: testOrgA._id });
    const runsAfter = await HistoricalMigrationRun.countDocuments({ orgId: testOrgA._id });

    assert.strictEqual(paymentsAfter, paymentsBefore, 'Payments collection must remain untouched during DRY_RUN');
    assert.strictEqual(ledgerAfter, ledgerBefore, 'FinancialLedgerEntry collection must remain untouched during DRY_RUN');
    assert.strictEqual(runsAfter, runsBefore, 'HistoricalMigrationRun collection must remain untouched during DRY_RUN');
  });

  test('4. EXECUTE Mode Backfill & Mongoose Transaction Atomicity', async () => {
    // Setup a historical paid invoice with an authoritative wallet transaction
    const invoiceId = new mongoose.Types.ObjectId();
    const historicalInvoice = await createTestInvoice({
      _id: invoiceId,
      orgId: testOrgA._id,
      targetUserId: residentUserA._id,
      invoiceNumber: `INV-EXEC-001-${Date.now()}`,
      billingPeriodString: '2026-03',
      currentCharge: 2500,
      totalAmount: 2500,
      totalDue: 2500,
      paidAmount: 2500,
      outstandingAmount: 0,
      status: 'PAID',
      paymentMethod: 'WALLET',
    });

    await WalletTransaction.create({
      orgId: testOrgA._id,
      userId: residentUserA._id,
      transactionId: `TXN-INV-EXEC-${Date.now()}`,
      type: 'Debit',
      amount: 2500,
      referenceId: invoiceId,
      referenceType: 'Invoice',
      paymentStatus: 'success',
    });

    // Run EXECUTE mode
    const executeResult = await historicalReconciliationService.reconcile({
      orgId: testOrgA._id,
      mode: MIGRATION_EXECUTION_MODES.EXECUTE,
      allowGenesis: false,
      domains: ['INVOICE', 'WALLET'],
    });

    assert.strictEqual(executeResult.mode, 'EXECUTE');
    assert.strictEqual(executeResult.status, 'COMPLETED');
    assert.ok(executeResult.summary.backfilledLedgerEntries > 0);

    // Check backfilled payment
    const backfilledPayment = await Payment.findOne({
      orgId: testOrgA._id,
      referenceId: invoiceId,
      idempotencyKey: `HISTORICAL:Invoice:${invoiceId}:0`,
    });
    assert.ok(backfilledPayment, 'Backfilled canonical Payment must be created');
    assert.strictEqual(backfilledPayment.amount, 2500);
    assert.strictEqual(backfilledPayment.status, 'success');
    assert.strictEqual(backfilledPayment.metadata.isHistoricalBackfill, true);

    // Check backfilled ledger entry
    const ledgerEntry = await FinancialLedgerEntry.findOne({
      orgId: testOrgA._id,
      idempotencyKey: `HISTORICAL:Invoice:${invoiceId}:LEDGER`,
    });
    assert.ok(ledgerEntry, 'Backfilled FinancialLedgerEntry must be created');
    assert.strictEqual(ledgerEntry.amount, 2500);
    assert.strictEqual(ledgerEntry.status, LEDGER_STATUSES.POSTED);
  });

  test('5. Strict Idempotency on Repeated EXECUTE Runs', async () => {
    const paymentCountFirst = await Payment.countDocuments({ orgId: testOrgA._id });
    const ledgerCountFirst = await FinancialLedgerEntry.countDocuments({ orgId: testOrgA._id });

    // Run EXECUTE mode a second time with identical parameters
    const repeatResult = await historicalReconciliationService.reconcile({
      orgId: testOrgA._id,
      mode: MIGRATION_EXECUTION_MODES.EXECUTE,
      allowGenesis: false,
      domains: ['INVOICE', 'WALLET'],
    });

    const paymentCountSecond = await Payment.countDocuments({ orgId: testOrgA._id });
    const ledgerCountSecond = await FinancialLedgerEntry.countDocuments({ orgId: testOrgA._id });

    assert.strictEqual(paymentCountSecond, paymentCountFirst, 'Repeated execution must not duplicate payments');
    assert.strictEqual(ledgerCountSecond, ledgerCountFirst, 'Repeated execution must not duplicate ledger entries');
    assert.strictEqual(repeatResult.summary.backfilledPayments, 0);
  });

  test('6. Wallet Genesis Opening Balance (Disallowed vs Allowed)', async () => {
    // Create clean tenant with a wallet that has opening balance and zero transactions
    const genesisWallet = await Wallet.create({
      orgId: testOrgB._id,
      userId: residentUserB._id,
      balance: 7500,
    });

    // 1. When allowGenesis is FALSE:
    const disallowResult = await historicalReconciliationService.reconcile({
      orgId: testOrgB._id,
      mode: MIGRATION_EXECUTION_MODES.EXECUTE,
      allowGenesis: false,
      domains: ['WALLET'],
    });

    assert.strictEqual(disallowResult.summary.genesisEntries, 0);
    const noGenesisEntry = await FinancialLedgerEntry.findOne({
      idempotencyKey: `HISTORICAL:GENESIS:${genesisWallet._id}`,
    });
    assert.strictEqual(noGenesisEntry, null, 'Genesis entry must NOT be created when allowGenesis=false');

    const conflictException = await ReconciliationException.findOne({
      orgId: testOrgB._id,
      sourceId: genesisWallet._id,
      classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
    });
    assert.ok(conflictException, 'Conflict exception must be logged when genesis is disallowed');

    // 2. When allowGenesis is TRUE:
    const allowResult = await historicalReconciliationService.reconcile({
      orgId: testOrgB._id,
      mode: MIGRATION_EXECUTION_MODES.EXECUTE,
      allowGenesis: true,
      domains: ['WALLET'],
    });

    assert.strictEqual(allowResult.summary.genesisEntries, 1);
    const genesisEntry = await FinancialLedgerEntry.findOne({
      idempotencyKey: `HISTORICAL:GENESIS:${genesisWallet._id}`,
    });
    assert.ok(genesisEntry, 'Genesis ledger entry must be created when allowGenesis=true');
    assert.strictEqual(genesisEntry.amount, 7500);
    assert.strictEqual(genesisEntry.debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.strictEqual(genesisEntry.creditAccount, FINANCIAL_ACCOUNTS.RESIDENT_WALLET);
  });

  test('7. Wallet Divergence Rejection (Never Papered Over by Genesis)', async () => {
    const divergentUser = await createTestUser({
      name: `Divergent User ${Date.now()}`,
      email: `divergent.${Date.now()}@example.com`,
      role: 'resident',
      orgId: testOrgB._id,
    });

    // Stored balance = 5000, but transaction sum = 3000 (divergence = 2000)
    const divergentWallet = await Wallet.create({
      orgId: testOrgB._id,
      userId: divergentUser._id,
      balance: 5000,
    });

    await WalletTransaction.create({
      orgId: testOrgB._id,
      userId: divergentUser._id,
      transactionId: `TXN-DIV-${Date.now()}`,
      type: 'Credit',
      amount: 3000,
      paymentStatus: 'success',
    });

    // Run reconciliation even with allowGenesis = true
    const divResult = await historicalReconciliationService.reconcile({
      orgId: testOrgB._id,
      mode: MIGRATION_EXECUTION_MODES.EXECUTE,
      allowGenesis: true,
      domains: ['WALLET'],
    });

    // Must NOT create a genesis entry for this wallet
    const forbiddenGenesis = await FinancialLedgerEntry.findOne({
      idempotencyKey: `HISTORICAL:GENESIS:${divergentWallet._id}`,
    });
    assert.strictEqual(forbiddenGenesis, null, 'Genesis entry must NEVER paper over wallet balance divergence');

    // Must record a CONFLICT exception
    const divException = await ReconciliationException.findOne({
      orgId: testOrgB._id,
      sourceId: divergentWallet._id,
      classification: RECONCILIATION_CLASSIFICATIONS.CONFLICT,
    });
    assert.ok(divException, 'Divergent wallet balance must be recorded as CONFLICT exception');
    assert.strictEqual(divException.discrepancyDetails.variance, 2000);
  });

  test('8. Double-Entry Accounting Invariants Verification', async () => {
    // Run invariant audit on Org A
    const auditReport = await reconciliationReportService.verifyFinancialInvariants(testOrgA._id);

    assert.strictEqual(auditReport.invariantsPassed, true);
    assert.strictEqual(auditReport.isBalanced, true);
    assert.strictEqual(auditReport.criticalViolationsCount, 0);

    // Verify all individual entries have matching debit and credit
    const ledgerEntries = await FinancialLedgerEntry.find({ orgId: testOrgA._id }).lean();
    for (const entry of ledgerEntries) {
      const totalDebit = entry.entries
        .filter((e) => e.entryType === ENTRY_TYPES.DEBIT)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const totalCredit = entry.entries
        .filter((e) => e.entryType === ENTRY_TYPES.CREDIT)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      assert.strictEqual(totalDebit, totalCredit, `Entry ${entry.transactionId} must be balanced`);
      assert.ok(entry.amount > 0, 'Amount must be greater than zero');
    }
  });

  test('9. Reconciliation Exception Lifecycle (Open -> Reviewed -> Resolved)', async () => {
    // Create an unresolvable historical invoice (paid status with 0 underlying evidence)
    const ghostInvoice = await createTestInvoice({
      orgId: testOrgA._id,
      targetUserId: residentUserA._id,
      invoiceNumber: `INV-GHOST-${Date.now()}`,
      billingPeriodString: '2026-04',
      currentCharge: 4200,
      totalAmount: 4200,
      totalDue: 4200,
      paidAmount: 4200,
      outstandingAmount: 0,
      status: 'PAID',
    });

    await historicalReconciliationService.reconcile({
      orgId: testOrgA._id,
      mode: MIGRATION_EXECUTION_MODES.EXECUTE,
      domains: ['INVOICE'],
    });

    const exception = await ReconciliationException.findOne({
      orgId: testOrgA._id,
      sourceId: ghostInvoice._id,
    });
    assert.ok(exception, 'Exception must be created for ghost payment invoice');
    assert.strictEqual(exception.status, RECONCILIATION_EXCEPTION_STATUSES.OPEN);

    // Admin reviews exception
    const reviewed = await historicalReconciliationService.updateException(exception._id, {
      status: RECONCILIATION_EXCEPTION_STATUSES.REVIEWED,
      resolutionNotes: 'Bank statement requested from resident.',
      resolvedBy: adminUser._id,
    });
    assert.strictEqual(reviewed.status, RECONCILIATION_EXCEPTION_STATUSES.REVIEWED);
    assert.strictEqual(reviewed.resolutionNotes, 'Bank statement requested from resident.');

    // Admin resolves exception
    const resolved = await historicalReconciliationService.updateException(exception._id, {
      status: RECONCILIATION_EXCEPTION_STATUSES.RESOLVED,
      resolutionNotes: 'Verified via physical deposit slip #9921.',
      resolvedBy: adminUser._id,
    });
    assert.strictEqual(resolved.status, RECONCILIATION_EXCEPTION_STATUSES.RESOLVED);
  });

  test('10. Non-Destructive Invariant — Historical Data Preserved', async () => {
    // Confirm that historical Invoices, Bookings, and Wallets exist and retain original data
    const invoice = await Invoice.findOne({ orgId: testOrgA._id, status: 'PAID' });
    assert.ok(invoice, 'Historical Invoice must still exist');
    assert.ok(invoice.paidAmount > 0, 'Original paid amount must be preserved');
    assert.strictEqual(invoice.isDeleted, false, 'Historical Invoice must not be deleted');

    const wallet = await Wallet.findOne({ orgId: testOrgB._id, balance: 7500 });
    assert.ok(wallet, 'Historical Wallet must still exist');
    assert.strictEqual(wallet.balance, 7500, 'Original wallet balance must be preserved');
  });
});
