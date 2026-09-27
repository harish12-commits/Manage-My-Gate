/**
 * NAHOM — Unified Financial Architecture
 * Phase 5 Test Suite: Billing / Invoice Migration to Unified Payment Core
 * 
 * Validates:
 * 1. Online Payment Lifecycle via Unified Payment Core (Order creation, signature verification, settlement, ledger)
 * 2. Online Webhook Ingress & Idempotency Replay Safety
 * 3. Digital Wallet Payment for Invoices (Atomic deduction, ledger recording, insufficient balance protection)
 * 4. Multi-Installment & Partial Invoice Payments (Sequential partial payments, proportional balanced ledger entries)
 * 5. Direct Cash Payment Recording (Receipt generation, atomic update, cash clearing ledger)
 * 6. Bank Transfer & Cheque Offline Workflow (Resident submission, admin verification, bank clearing ledger)
 * 7. Security, Tenant Isolation & Financial Integrity (Cross-tenant rejection, overpayment rejection, negative amounts)
 * 8. Transaction Rollback & Failure Protection (Atomic rollback on settlement failure)
 * 9. Financial Reconciliation Consistency Audit (Zero unledgered payments, clean audit status)
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
import invoiceService from '../src/features/invoice/invoice.services.js';
import walletService from '../src/features/wallet/wallet.service.js';
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

describe('Phase 5: Billing / Invoice Migration to Unified Payment Core', () => {
  let testOrgId;
  let otherOrgId;
  let testUserId;
  let adminUserId;
  let httpServer;

  async function createTestInvoice(overrides = {}) {
    const amount = overrides.totalAmount || overrides.totalDue || 5000;
    const paid = overrides.paidAmount || 0;
    const outstanding = overrides.outstandingAmount !== undefined ? overrides.outstandingAmount : Math.max(0, amount - paid);
    const orgId = overrides.orgId || overrides.communityId || testOrgId;

    return await Invoice.create({
      orgId,
      communityId: orgId,
      assessmentId: new mongoose.Types.ObjectId(),
      targetUserId: overrides.targetUserId || testUserId,
      unitId: new mongoose.Types.ObjectId(),
      billingPeriodString: '2026-12',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      invoiceNumber: overrides.invoiceNumber || `INV-P5-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
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

      testOrgId = new mongoose.Types.ObjectId();
      otherOrgId = new mongoose.Types.ObjectId();
      testUserId = new mongoose.Types.ObjectId();
      adminUserId = new mongoose.Types.ObjectId();

      const orgSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // 1. Primary Test Organization
      await Organization.create({
        _id: testOrgId,
        name: `Phase 5 Billing Community ${orgSuffix}`,
        code: `P5B_${Date.now() % 10000000}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '500 Invoice Blvd', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 2. Secondary Organization (for cross-tenant tests)
      await Organization.create({
        _id: otherOrgId,
        name: `Phase 5 Other Community ${orgSuffix}`,
        code: `P5O_${Date.now() % 10000000}`,
        organizationType: 'Residential',
        status: 'Active',
        address: { street: '600 Isolated Way', city: 'Bangalore', state: 'KA', zip: '560001' },
      });

      // 3. Resident User
      await User.create({
        _id: testUserId,
        name: 'Phase 5 Resident',
        firstName: 'Billing',
        lastName: 'Resident',
        email: `billing_resident_${Date.now()}@example.com`,
        username: `resident_p5_${Date.now()}`,
        password: 'HashedPassword123!',
        userRole: 'resident',
        orgId: testOrgId,
        status: 'Active',
      });

      // 4. Admin User
      await User.create({
        _id: adminUserId,
        name: 'Phase 5 Facility Admin',
        firstName: 'Facility',
        lastName: 'Admin',
        email: `admin_p5_${Date.now()}@example.com`,
        username: `admin_p5_${Date.now()}`,
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
        'Phase 5 Razorpay Gateway',
        {
          keyId: 'rzp_test_p5_1234567890',
          keySecret: 'sec_test_p5_keysecret1234',
        }
      );
    } catch (err) {
      console.error('CRITICAL: Error in Phase 5 before() hook:', err);
      throw err;
    }
  });

  after(async () => {
    try {
      await Payment.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Invoice.deleteMany({ communityId: { $in: [testOrgId, otherOrgId] } });
      await Wallet.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await WalletTransaction.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await FinancialLedgerEntry.collection.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
      await Organization.deleteMany({ _id: { $in: [testOrgId, otherOrgId] } });
      await User.deleteMany({ orgId: { $in: [testOrgId, otherOrgId] } });
    } catch (teardownErr) {
      console.error('Error during Phase 5 test teardown:', teardownErr);
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

  test('Test 1.1 — Order Creation: PaymentContextFactory constructs authoritative invoice order', async () => {
    const invoice = await createTestInvoice({ totalAmount: 5000, paidAmount: 0 });

    const context = PaymentContextFactory.fromInvoice(invoice, {
      amount: 5000,
      userId: testUserId,
      orgId: testOrgId,
      paymentMethod: CANONICAL_PAYMENT_METHODS.ONLINE,
    });

    assert.equal(context.domain, PAYMENT_DOMAINS.INVOICE);
    assert.equal(context.referenceId, invoice._id.toString());
    assert.equal(context.amount, 5000);
    assert.equal(context.orgId, testOrgId.toString());

    const orderResult = await unifiedPaymentService.createPaymentOrder(context);
    assert.ok(orderResult);
    assert.equal(orderResult.success, true);
    assert.ok(orderResult.orderId);
    assert.equal(orderResult.amount, 5000);

    const paymentRecord = await Payment.findById(orderResult.paymentId);
    assert.ok(paymentRecord);
    assert.equal(paymentRecord.status, 'pending');
    assert.equal(paymentRecord.referenceType, 'Invoice');
    assert.equal(paymentRecord.referenceId.toString(), invoice._id.toString());
  });

  test('Test 1.2 — Online Payment Settlement: signature verification settles invoice and records EXTERNAL_CLEARING -> INVOICE_RECEIVABLE ledger', async () => {
    const invoice = await createTestInvoice({ totalAmount: 4500, paidAmount: 0 });

    const context = PaymentContextFactory.fromInvoice(invoice, {
      amount: 4500,
      userId: testUserId,
      orgId: testOrgId,
    });

    const orderResult = await unifiedPaymentService.createPaymentOrder(context);
    const mockRzpPaymentId = `pay_rzp_${Date.now()}`;

    const verifyResult = await unifiedPaymentService.verifyPayment({
      orgId: testOrgId,
      paymentId: orderResult.paymentId,
      orderId: orderResult.orderId,
      razorpayPaymentId: mockRzpPaymentId,
      razorpaySignature: 'sig_mock_signature_test',
    });

    assert.ok(verifyResult);
    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.settlement.payment.status, 'success');

    // Verify Invoice state
    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.paidAmount, 4500);
    assert.equal(updatedInvoice.outstandingAmount, 0);

    // Verify Financial Ledger Entry
    const ledgerEntries = await financialLedgerRepository.findByPaymentId(orderResult.paymentId);
    assert.equal(ledgerEntries.length, 1);
    const entry = ledgerEntries[0];
    assert.equal(entry.domain, 'INVOICE');
    assert.equal(entry.debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(entry.creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(entry.amount, 4500);
    assert.equal(entry.status, LEDGER_STATUSES.POSTED);

    // Verify balanced double entry
    const debits = entry.entries.filter((e) => e.entryType === ENTRY_TYPES.DEBIT).reduce((s, e) => s + e.amount, 0);
    const credits = entry.entries.filter((e) => e.entryType === ENTRY_TYPES.CREDIT).reduce((s, e) => s + e.amount, 0);
    assert.equal(debits, 4500);
    assert.equal(credits, 4500);
  });

  // --------------------------------------------------------------------------
  // Group 2: Online Payment Webhook Ingress & Idempotency
  // --------------------------------------------------------------------------

  test('Test 2.1 — Webhook Ingress: settleInvoiceFromWebhook settles invoice and posts ledger entry', async () => {
    const invoice = await createTestInvoice({ totalAmount: 3200, paidAmount: 0 });
    const webhookPaymentId = `pay_wh_${Date.now()}`;

    const result = await invoiceService.settleInvoiceFromWebhook(invoice._id, {
      paymentId: webhookPaymentId,
      amount: 3200,
      method: 'RAZORPAY',
    });

    assert.ok(result);
    assert.equal(result.success, true);

    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.paidAmount, 3200);
    assert.equal(updatedInvoice.outstandingAmount, 0);

    // Verify canonical Payment record
    const payment = await Payment.findOne({ gatewayTransactionId: webhookPaymentId });
    assert.ok(payment);
    assert.equal(payment.status, 'success');
    assert.equal(payment.amount, 3200);

    // Verify ledger entry
    const ledger = await financialLedgerRepository.findByPaymentId(payment._id);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger[0].amount, 3200);
  });

  test('Test 2.2 — Duplicate Webhook Replay: idempotent lock prevents duplicate settlement or ledger entries', async () => {
    const invoice = await createTestInvoice({ totalAmount: 1800, paidAmount: 0 });
    const duplicatePaymentId = `pay_dup_wh_${Date.now()}`;

    // 1st delivery
    const res1 = await invoiceService.settleInvoiceFromWebhook(invoice._id, {
      paymentId: duplicatePaymentId,
      amount: 1800,
      method: 'RAZORPAY',
    });
    assert.equal(res1.success, true);

    // 2nd delivery (replayed webhook)
    const res2 = await invoiceService.settleInvoiceFromWebhook(invoice._id, {
      paymentId: duplicatePaymentId,
      amount: 1800,
      method: 'RAZORPAY',
    });
    assert.equal(res2.success, true);
    assert.match(res2.message, /Duplicate webhook/i);

    // 3rd delivery (replayed webhook)
    const res3 = await invoiceService.settleInvoiceFromWebhook(invoice._id, {
      paymentId: duplicatePaymentId,
      amount: 1800,
      method: 'RAZORPAY',
    });
    assert.equal(res3.success, true);

    // Confirm only 1 ledger entry exists for this transaction
    const payment = await Payment.findOne({ gatewayTransactionId: duplicatePaymentId });
    const ledgers = await financialLedgerRepository.findByPaymentId(payment._id);
    assert.equal(ledgers.length, 1);
  });

  // --------------------------------------------------------------------------
  // Group 3: Digital Wallet Payment for Invoices
  // --------------------------------------------------------------------------

  test('Test 3.1 — Wallet Invoice Payment: payInvoiceWithWallet debits wallet and records RESIDENT_WALLET -> INVOICE_RECEIVABLE ledger', async () => {
    // Seed resident wallet with ₹8,000
    await walletService.creditWallet({
      userId: testUserId,
      orgId: testOrgId,
      amount: 8000,
      referenceType: 'Recharge',
      description: 'Test seed wallet',
    });

    const invoice = await createTestInvoice({ totalAmount: 4000, paidAmount: 0 });

    const payResult = await walletService.payInvoiceWithWallet(
      testUserId,
      invoice._id,
      4000,
      testOrgId
    );

    assert.ok(payResult);
    assert.equal(payResult.success, true);
    assert.equal(payResult.walletBalance, 4000); // 8000 - 4000 = 4000

    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.paidAmount, 4000);
    assert.equal(updatedInvoice.outstandingAmount, 0);

    // Check double-entry ledger entry
    const ledger = await FinancialLedgerEntry.findOne({
      referenceId: invoice._id,
      debitAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
    });
    assert.ok(ledger);
    assert.equal(ledger.creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger.amount, 4000);
    assert.equal(ledger.status, LEDGER_STATUSES.POSTED);
  });

  test('Test 3.2 — Insufficient Wallet Balance: payInvoiceWithWallet rejects without debit or ledger entries', async () => {
    // Current wallet balance is ₹4,000 from previous test
    const invoice = await createTestInvoice({ totalAmount: 9000, paidAmount: 0 });

    await assert.rejects(
      async () => {
        await walletService.payInvoiceWithWallet(
          testUserId,
          invoice._id,
          9000,
          testOrgId
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Insufficient wallet balance/i);
        return true;
      }
    );

    // Verify invoice remains UNPAID
    const unchangedInvoice = await Invoice.findById(invoice._id);
    assert.equal(unchangedInvoice.status, 'UNPAID');
    assert.equal(unchangedInvoice.paidAmount, 0);

    // Verify wallet balance is intact
    const wallet = await walletService.getWalletData(testUserId, testOrgId);
    assert.equal(wallet.balance, 4000);
  });

  // --------------------------------------------------------------------------
  // Group 4: Multi-Installment & Partial Invoice Payments
  // --------------------------------------------------------------------------

  test('Test 4.1 — Multi-Installment Billing: sequential partial payments (Online + Cash + Wallet) update invoice and record proportional ledger entries', async () => {
    // Top up wallet for final partial payment
    await walletService.creditWallet({
      userId: testUserId,
      orgId: testOrgId,
      amount: 5000,
      referenceType: 'Recharge',
    });

    // Create a ₹10,000 invoice
    const invoice = await createTestInvoice({ totalAmount: 10000, paidAmount: 0 });

    // Step 1: 1st Partial Payment (Online ₹2,000)
    const context1 = PaymentContextFactory.fromInvoice(invoice, {
      amount: 2000,
      userId: testUserId,
      orgId: testOrgId,
    });
    const order1 = await unifiedPaymentService.createPaymentOrder(context1);
    await unifiedPaymentService.verifyPayment({
      orgId: testOrgId,
      paymentId: order1.paymentId,
      orderId: order1.orderId,
      razorpayPaymentId: `pay_part1_${Date.now()}`,
      razorpaySignature: 'sig_mock_part1',
    });

    const invAfterPart1 = await Invoice.findById(invoice._id);
    assert.equal(invAfterPart1.status, 'PARTIALLY_PAID');
    assert.equal(invAfterPart1.paidAmount, 2000);
    assert.equal(invAfterPart1.outstandingAmount, 8000);

    const ledger1 = await financialLedgerRepository.findByPaymentId(order1.paymentId);
    assert.equal(ledger1.length, 1);
    assert.equal(ledger1[0].debitAccount, FINANCIAL_ACCOUNTS.EXTERNAL_CLEARING);
    assert.equal(ledger1[0].creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger1[0].amount, 2000);

    // Step 2: 2nd Partial Payment (Cash ₹3,000)
    const cashResult = await invoiceService.recordCashPayment(invoice._id, 3000, adminUserId);
    assert.ok(cashResult);

    const invAfterPart2 = await Invoice.findById(invoice._id);
    assert.equal(invAfterPart2.status, 'PARTIALLY_PAID');
    assert.equal(invAfterPart2.paidAmount, 5000);
    assert.equal(invAfterPart2.outstandingAmount, 5000);

    const ledger2 = await FinancialLedgerEntry.findOne({
      referenceId: invoice._id,
      debitAccount: FINANCIAL_ACCOUNTS.CASH_CLEARING,
      amount: 3000,
    });
    assert.ok(ledger2);
    assert.equal(ledger2.creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);

    // Step 3: Final Partial Payment (Wallet ₹5,000)
    const walletResult = await walletService.payInvoiceWithWallet(
      testUserId,
      invoice._id,
      5000,
      testOrgId
    );
    assert.ok(walletResult.success);

    const invFinal = await Invoice.findById(invoice._id);
    assert.equal(invFinal.status, 'PAID');
    assert.equal(invFinal.paidAmount, 10000);
    assert.equal(invFinal.outstandingAmount, 0);

    const ledger3 = await FinancialLedgerEntry.findOne({
      referenceId: invoice._id,
      debitAccount: FINANCIAL_ACCOUNTS.RESIDENT_WALLET,
      amount: 5000,
    });
    assert.ok(ledger3);
    assert.equal(ledger3.creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);

    // Verify Cumulative Ledger Balance for this invoice
    const allInvoiceLedgers = await FinancialLedgerEntry.find({
      referenceId: { $in: [invoice._id, invoice._id.toString()] },
      creditAccount: FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE,
      status: LEDGER_STATUSES.POSTED,
    });
    assert.equal(allInvoiceLedgers.length, 3);
    const totalCreditToReceivable = allInvoiceLedgers.reduce((sum, l) => sum + l.amount, 0);
    assert.equal(totalCreditToReceivable, 10000);
  });

  // --------------------------------------------------------------------------
  // Group 5: Direct Cash Payment Recording (Admin/Facility Desk)
  // --------------------------------------------------------------------------

  test('Test 5.1 — Cash Payment Recording: recordCashPayment generates receipt and CASH_CLEARING -> INVOICE_RECEIVABLE ledger entry', async () => {
    const invoice = await createTestInvoice({ totalAmount: 2500, paidAmount: 0 });

    const result = await invoiceService.recordCashPayment(invoice._id, 2500, adminUserId);

    assert.ok(result);
    assert.ok(result.receiptNumber);
    assert.match(result.receiptNumber, /^CASH-\d{4}-\d{6}$/);

    const updatedInvoice = await Invoice.findById(invoice._id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.paidAmount, 2500);
    assert.equal(updatedInvoice.outstandingAmount, 0);
    assert.equal(updatedInvoice.paymentMethod, 'CASH');

    // Verify canonical Payment record
    const payment = await Payment.findOne({ receiptNumber: result.receiptNumber });
    assert.ok(payment);
    assert.equal(payment.status, 'success');
    assert.equal(payment.paymentCategory, 'OFFLINE');
    assert.equal(payment.paymentMethod, 'CASH');
    assert.equal(payment.amount, 2500);

    // Verify financial ledger
    const ledger = await financialLedgerRepository.findByPaymentId(payment._id);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.CASH_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger[0].amount, 2500);
  });

  test('Test 5.2 — Cash Overpayment Rejection: paying more than outstanding due or paying settled invoice is rejected', async () => {
    const invoice = await createTestInvoice({ totalAmount: 1500, paidAmount: 0 });

    // Attempt paying ₹2,000 on ₹1,500 due
    await assert.rejects(
      async () => {
        await invoiceService.recordCashPayment(invoice._id, 2000, adminUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /exceeds outstanding balance/i);
        return true;
      }
    );

    // Pay exact amount
    await invoiceService.recordCashPayment(invoice._id, 1500, adminUserId);

    // Attempt paying again on already paid invoice
    await assert.rejects(
      async () => {
        await invoiceService.recordCashPayment(invoice._id, 500, adminUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /already fully paid/i);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Group 6: Bank Transfer & Cheque Offline Workflow
  // --------------------------------------------------------------------------

  test('Test 6.1 — Bank Transfer Workflow: logOfflinePayment + approveOfflinePayment records BANK_CLEARING -> INVOICE_RECEIVABLE ledger', async () => {
    const invoice = await createTestInvoice({ totalAmount: 6000, paidAmount: 0 });
    const utrRef = `UTR-HDFC-${Date.now()}`;

    // 1. Resident logs offline payment
    const logged = await invoiceService.logOfflinePayment(
      invoice._id,
      utrRef,
      6000,
      'BANK_TRANSFER'
    );
    assert.equal(logged.status, 'VERIFICATION_PENDING');

    // 2. Admin approves offline payment
    const approved = await invoiceService.approveOfflinePayment(
      invoice._id,
      adminUserId,
      { paymentMethod: 'BANK_TRANSFER', amount: 6000 }
    );

    assert.equal(approved.status, 'PAID');
    assert.ok(approved.receiptNumber);

    const payment = await Payment.findOne({ paymentReference: utrRef });
    assert.ok(payment);
    assert.equal(payment.status, 'success');
    assert.equal(payment.paymentMethod, 'BANK_TRANSFER');

    // Verify Financial Ledger Entry
    const ledger = await financialLedgerRepository.findByPaymentId(payment._id);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.BANK_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger[0].amount, 6000);
  });

  test('Test 6.2 — Cheque Payment Workflow: approveOfflinePayment for CHEQUE records BANK_CLEARING -> INVOICE_RECEIVABLE ledger', async () => {
    const invoice = await createTestInvoice({ totalAmount: 7500, paidAmount: 0 });
    const chqRef = `CHQ-${Date.now()}`;

    await invoiceService.logOfflinePayment(invoice._id, chqRef, 7500, 'CHEQUE');

    const approved = await invoiceService.approveOfflinePayment(
      invoice._id,
      adminUserId,
      { paymentMethod: 'CHEQUE', amount: 7500 }
    );

    assert.equal(approved.status, 'PAID');

    const payment = await Payment.findOne({ paymentReference: chqRef });
    assert.ok(payment);
    assert.equal(payment.status, 'success');

    const ledger = await financialLedgerRepository.findByPaymentId(payment._id);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].debitAccount, FINANCIAL_ACCOUNTS.BANK_CLEARING);
    assert.equal(ledger[0].creditAccount, FINANCIAL_ACCOUNTS.INVOICE_RECEIVABLE);
    assert.equal(ledger[0].amount, 7500);
  });

  test('Test 6.3 — Duplicate Offline Reference: submitting same UTR twice is rejected', async () => {
    const invoice1 = await createTestInvoice({ totalAmount: 2000, paidAmount: 0 });
    const invoice2 = await createTestInvoice({ totalAmount: 2000, paidAmount: 0 });
    const duplicateUtr = `UTR-SBI-DUPLICATE-${Date.now()}`;

    await invoiceService.logOfflinePayment(invoice1._id, duplicateUtr, 2000, 'BANK_TRANSFER');

    await assert.rejects(
      async () => {
        await invoiceService.logOfflinePayment(invoice2._id, duplicateUtr, 2000, 'BANK_TRANSFER');
      },
      (err) => {
        assert.match(err.message, /already been submitted/i);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Group 7: Security, Tenant Isolation & Financial Integrity
  // --------------------------------------------------------------------------

  test('Test 7.1 — Cross-Tenant Payment Rejection: payment order for another community invoice is blocked with 403', async () => {
    // Invoice belongs to otherOrgId
    const foreignInvoice = await createTestInvoice({
      orgId: otherOrgId,
      communityId: otherOrgId,
      totalAmount: 3000,
    });

    const foreignContext = new (await import('../src/features/payment/payment.types.js')).PaymentContext({
      domain: PAYMENT_DOMAINS.INVOICE,
      referenceId: foreignInvoice._id.toString(),
      referenceType: 'Invoice',
      orgId: testOrgId.toString(), // Client claims testOrgId, but invoice belongs to otherOrgId
      userId: testUserId.toString(),
      amount: 3000,
    });

    await assert.rejects(
      async () => {
        await unifiedPaymentService.createPaymentOrder(foreignContext);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Cross-tenant payment forbidden/i);
        return true;
      }
    );
  });

  test('Test 7.2 — Amount Tampering: requesting payment exceeding outstanding amount is rejected with 400', async () => {
    const invoice = await createTestInvoice({ totalAmount: 1200, paidAmount: 0 });

    const tamperedContext = PaymentContextFactory.fromInvoice(invoice, {
      amount: 99999, // Tampered client amount
      userId: testUserId,
      orgId: testOrgId,
    });

    await assert.rejects(
      async () => {
        await unifiedPaymentService.createPaymentOrder(tamperedContext);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /exceeds remaining invoice due/i);
        return true;
      }
    );
  });

  test('Test 7.3 — Zero and Negative Amounts: rejected with 400', async () => {
    const invoice = await createTestInvoice({ totalAmount: 1000, paidAmount: 0 });

    assert.throws(
      () => {
        PaymentContextFactory.fromInvoice(invoice, {
          amount: 0,
          userId: testUserId,
          orgId: testOrgId,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    assert.throws(
      () => {
        PaymentContextFactory.fromInvoice(invoice, {
          amount: -500,
          userId: testUserId,
          orgId: testOrgId,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('Test 7.4 — Settled / Cancelled Invoice Protection: cannot create order for PAID or CANCELLED invoice', async () => {
    const paidInvoice = await createTestInvoice({ totalAmount: 1000, paidAmount: 1000, status: 'PAID' });
    const cancelledInvoice = await createTestInvoice({ totalAmount: 1000, status: 'CANCELLED' });

    await assert.rejects(
      async () => {
        const ctx = PaymentContextFactory.fromInvoice(paidInvoice, {
          amount: 1000,
          userId: testUserId,
          orgId: testOrgId,
          validate: false,
        });
        await unifiedPaymentService.createPaymentOrder(ctx);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /already been fully settled/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        const ctx = PaymentContextFactory.fromInvoice(cancelledInvoice, {
          amount: 1000,
          userId: testUserId,
          orgId: testOrgId,
          validate: false,
        });
        await unifiedPaymentService.createPaymentOrder(ctx);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cancelled and cannot accept payments/i);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Group 8: Transaction Rollback & Failure Protection
  // --------------------------------------------------------------------------

  test('Test 8.1 — Transaction Rollback: simulated ledger failure in settlePayment rolls back payment status and invoice state', async () => {
    const invoice = await createTestInvoice({ totalAmount: 4800, paidAmount: 0 });

    const context = PaymentContextFactory.fromInvoice(invoice, {
      amount: 4800,
      userId: testUserId,
      orgId: testOrgId,
    });

    const order = await unifiedPaymentService.createPaymentOrder(context);

    // Mock financialLedgerService.recordSettlementLedgerEntry to throw an error
    const origRecord = financialLedgerService.recordSettlementLedgerEntry;
    financialLedgerService.recordSettlementLedgerEntry = async () => {
      throw new Error('Simulated Database Ledger Failure');
    };

    try {
      await assert.rejects(
        async () => {
          await paymentSettlementService.settlePayment({
            paymentId: order.paymentId,
            gatewayTransactionId: `pay_mock_fail_${Date.now()}`,
          });
        },
        (err) => {
          assert.match(err.message, /Simulated Database Ledger Failure/i);
          return true;
        }
      );

      // Verify Payment record was NOT marked 'success'
      const paymentAfter = await Payment.findById(order.paymentId);
      assert.notEqual(paymentAfter.status, 'success');

      // Verify Invoice was NOT marked 'PAID'
      const invoiceAfter = await Invoice.findById(invoice._id);
      assert.notEqual(invoiceAfter.status, 'PAID');
      assert.equal(invoiceAfter.paidAmount, 0);
    } finally {
      financialLedgerService.recordSettlementLedgerEntry = origRecord;
    }
  });

  // --------------------------------------------------------------------------
  // Group 9: Financial Reconciliation Consistency Audit
  // --------------------------------------------------------------------------

  test('Test 9.1 — Reconciliation Auditor: verifies all settled invoice payments have balanced ledger entries with zero unledgered payments', async () => {
    const auditReport = await financialLedgerService.checkReconciliation(testOrgId);

    assert.ok(auditReport);
    assert.equal(auditReport.orgId, testOrgId.toString());
    assert.equal(auditReport.paymentsWithoutLedger.length, 0, `Unledgered payments detected: ${JSON.stringify(auditReport.paymentsWithoutLedger)}`);
    assert.equal(auditReport.walletTransactionsWithoutLedger.length, 0);
    assert.equal(auditReport.divergentWalletBalances.length, 0);
    assert.equal(auditReport.isClean, true);
  });
});
