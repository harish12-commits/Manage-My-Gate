/**
 * Billing email + safe pay-online links.
 * Uses a throwaway local database; Razorpay and SMTP are stubbed (no network).
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.PUBLIC_APP_URL = 'https://app.example.com';

const { default: Invoice } = await import('../src/features/invoice/invoice.model.js');
const { default: paymentService } = await import('../src/features/payment/payment.service.js');
const { default: userService } = await import('../src/features/user/user.services.js');
const payLink = await import('../src/features/invoice/invoicePayLink.service.js');
// Settlement writes these inside a transaction; register them so the fixture can create collections + indexes first.
await import('../src/features/ledger/financialLedgerEntry.model.js');
await import('../src/features/ledger/ledger.model.js');
await import('../src/features/wallet/wallet.model.js');
await import('../src/features/payment/payment.model.js');

const DB_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mmg').replace(/\/[^/?]+(\?|$)/, '/mmg_billing_email_test$1');
let dbReady = false;

const created = [];
const cancelled = [];
let linkSeq = 0;

before(async () => {
  try {
    await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.db.dropDatabase();
    // Transactions cannot create collections implicitly: pre-create every registered model collection.
    for (const model of Object.values(mongoose.models)) {
      await model.createCollection().catch(() => {});
      await model.ensureIndexes().catch(() => {});
    }
    dbReady = true;
  } catch {
    dbReady = false;
  }
  paymentService.createPaymentLink = async (invoice, user, { amount, attempt }) => {
    linkSeq += 1;
    created.push({ invoiceId: String(invoice._id), amount, attempt });
    return { id: `plink_${linkSeq}`, url: `https://rzp.io/l/${linkSeq}`, amount, expiresAt: new Date(Date.now() + 86400000) };
  };
  paymentService.cancelPaymentLink = async (orgId, id) => {
    cancelled.push(id);
    return true;
  };
  userService.getUserById = async (id) => ({ _id: id, name: 'Asha', email: 'asha@example.com' });
});

after(async () => {
  if (dbReady) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});

beforeEach(() => {
  created.length = 0;
  cancelled.length = 0;
});

const orgId = new mongoose.Types.ObjectId();
const makeInvoice = (overrides = {}) =>
  Invoice.collection.insertOne({
    orgId,
    communityId: orgId,
    targetUserId: new mongoose.Types.ObjectId(),
    invoiceNumber: `INV-${Math.random().toString(36).slice(2, 8)}`,
    unitId: new mongoose.Types.ObjectId(),
    assessmentId: new mongoose.Types.ObjectId(),
    billingPeriodString: '2026-10',
    currentCharge: 1500,
    currency: 'INR',
    totalAmount: 1500,
    totalDue: 1500,
    outstandingAmount: 1500,
    status: 'UNPAID',
    dueDate: new Date(Date.now() + 5 * 86400000),
    paymentLinkRegeneratedCount: 0,
    ...overrides,
  }).then((r) => r.insertedId);

describe('pay tokens', () => {
  test('round-trip and scope', () => {
    const token = payLink.signPayToken({ _id: 'abc123', orgId: 'org1' });
    assert.deepEqual(payLink.verifyPayToken(token), { invoiceId: 'abc123', orgId: 'org1' });
  });

  test('rejects tampered tokens and ordinary auth tokens', () => {
    const token = payLink.signPayToken({ _id: 'abc123', orgId: 'org1' });
    assert.equal(payLink.verifyPayToken(`${token}x`), null);
    const authToken = jwt.sign({ sub: 'abc123', typ: 'invoice_pay' }, process.env.JWT_SECRET);
    assert.equal(payLink.verifyPayToken(authToken), null, 'auth-secret token must not verify');
    assert.equal(payLink.verifyPayToken(''), null);
  });

  test('links point at the universal-link domain and the public API', () => {
    const { appUrl, payUrl } = payLink.buildInvoiceLinks({ _id: 'inv1', orgId: 'org1' });
    assert.match(appUrl, /^https:\/\/app\.example\.com\/billing\/invoice\/inv1\?t=/);
    assert.match(payUrl, /^https:\/\/app\.example\.com\/api\/billing-links\/.+\/pay$/);
  });
});

describe('ensureFreshPaymentLink', () => {
  test('creates a link for the outstanding amount, then reuses it', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    const first = await payLink.ensureFreshPaymentLink(id);
    assert.equal(first.state, 'ACTIVE');
    assert.equal(created.length, 1);
    assert.equal(created[0].amount, 1500);

    const second = await payLink.ensureFreshPaymentLink(id);
    assert.equal(second.url, first.url);
    assert.equal(created.length, 1, 'no new gateway link while amount is unchanged');
  });

  test('after a partial payment the old link is cancelled and a new one charges the new amount', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    const first = await payLink.ensureFreshPaymentLink(id);
    await Invoice.updateOne({ _id: id }, { $set: { outstandingAmount: 500, status: 'PARTIALLY_PAID' } });

    const next = await payLink.ensureFreshPaymentLink(id);
    assert.notEqual(next.url, first.url);
    assert.deepEqual(cancelled, [first.invoice.paymentLinkId]);
    assert.equal(created.at(-1).amount, 500);
    assert.equal(created.at(-1).attempt, 1, 'regenerated link gets a unique reference');
  });

  test('never issues a link for paid, cancelled or under-review invoices', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    for (const [status, expected] of [['PAID', 'PAID'], ['CANCELLED', 'CANCELLED'], ['VERIFICATION_PENDING', 'VERIFICATION_PENDING']]) {
      const id = await makeInvoice({ status, outstandingAmount: status === 'PAID' ? 0 : 1500 });
      assert.equal((await payLink.ensureFreshPaymentLink(id)).state, expected);
    }
    assert.equal(created.length, 0);
  });

  test('retireActivePaymentLink cancels the live link after a payment', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    const first = await payLink.ensureFreshPaymentLink(id);
    await Invoice.updateOne({ _id: id }, { $set: { status: 'PAID', outstandingAmount: 0 } });
    assert.equal(await payLink.retireActivePaymentLink(id), true);
    assert.deepEqual(cancelled, [first.invoice.paymentLinkId]);
    assert.equal((await Invoice.findById(id)).paymentLinkStatus, 'PAID');
    assert.equal(await payLink.retireActivePaymentLink(id), false, 'second call is a no-op');
  });
});

// ── P1: billing emails ──
const emailMod = await import('../src/features/invoice/invoice.email.js');
const { default: messageTemplateService } = await import('../src/features/messageTemplate/messageTemplate.service.js');
const { default: Organization } = await import('../src/features/organization/organization.model.js');

describe('billing emails', () => {
  const outbox = [];
  let smtpUp = true;
  let customTemplate = null;

  before(async () => {
    emailMod.setEmailSender(async (org, to, subject, html, opts) => {
      if (!smtpUp) return false;
      outbox.push({ org: String(org), to, subject, html, fromName: opts?.fromName });
      return true;
    });
    messageTemplateService.getTemplateByPurpose = async () => customTemplate;
    if (dbReady) await Organization.collection.insertOne({ _id: orgId, name: 'Green Valley', timezone: 'Asia/Kolkata' });
  });
  after(() => emailMod.setEmailSender());
  beforeEach(() => {
    outbox.length = 0;
    smtpUp = true;
    customTemplate = null;
  });

  test('invoice email: community sender, both links, amount and due date', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ invoiceNumber: 'INV-1001', billingPeriodString: 'Oct 2026' });
    assert.equal(await emailMod.sendInvoiceEmail('generated', id), 'sent');
    const [mail] = outbox;
    assert.equal(mail.to, 'asha@example.com');
    assert.equal(mail.fromName, 'Green Valley');
    assert.equal(mail.org, String(orgId));
    assert.match(mail.subject, /INV-1001/);
    assert.match(mail.subject, /₹1,500\.00/);
    assert.match(mail.html, /https:\/\/app\.example\.com\/billing\/invoice\//);
    assert.match(mail.html, /\/api\/billing-links\/[^"]+\/pay/);
    assert.match(mail.html, /Oct 2026/);
  });

  test('each automatic email is sent at most once', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    const results = await Promise.all([1, 2, 3].map(() => emailMod.sendInvoiceEmail('generated', id)));
    assert.deepEqual(results.filter((r) => r === 'sent').length, 1);
    assert.equal(outbox.length, 1);
  });

  test('SMTP failure releases the claim so a retry can send', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    smtpUp = false;
    assert.equal(await emailMod.sendInvoiceEmail('reminder', id), 'failed');
    smtpUp = true;
    assert.equal(await emailMod.sendInvoiceEmail('reminder', id), 'sent');
  });

  test('no reminder for paid invoices; receipts are per payment', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ status: 'PAID', outstandingAmount: 0 });
    assert.equal(await emailMod.sendInvoiceEmail('overdue', id), 'skipped:nothing-due');

    const p1 = { _id: new mongoose.Types.ObjectId(), amount: 1500, gatewayTransactionId: 'pay_A' };
    assert.equal(await emailMod.sendInvoiceEmail('receipt', id, { payment: p1 }), 'sent');
    assert.equal(await emailMod.sendInvoiceEmail('receipt', id, { payment: p1 }), 'skipped:already-sent');
    const p2 = { _id: new mongoose.Types.ObjectId(), amount: 200, gatewayTransactionId: 'pay_B' };
    assert.equal(await emailMod.sendInvoiceEmail('receipt', id, { payment: p2 }), 'sent');
    assert.match(outbox[0].html, /pay_A/);
  });

  test('admin manual reminder (force) can repeat', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    assert.equal(await emailMod.sendInvoiceEmail('reminder', id, { force: true }), 'sent');
    assert.equal(await emailMod.sendInvoiceEmail('reminder', id, { force: true }), 'sent');
  });

  test('skips residents without an email address', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const original = userService.getUserById;
    userService.getUserById = async (uid) => ({ _id: uid, name: 'No Mail' });
    try {
      const id = await makeInvoice();
      assert.equal(await emailMod.sendInvoiceEmail('generated', id), 'skipped:no-email');
    } finally {
      userService.getUserById = original;
    }
  });

  test('community custom template overrides the default; values are escaped', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    customTemplate = { subject: 'Bill {{invoice_number}}', body: '<p>Dear {{resident_name}}, pay at {{pay_link}}</p>' };
    const original = userService.getUserById;
    userService.getUserById = async (uid) => ({ _id: uid, name: '<b>Eve</b>', email: 'eve@example.com' });
    try {
      const id = await makeInvoice({ invoiceNumber: 'INV-7' });
      await emailMod.sendInvoiceEmail('generated', id);
      assert.equal(outbox[0].subject, 'Bill INV-7');
      assert.match(outbox[0].html, /Dear &lt;b&gt;Eve&lt;\/b&gt;/);
    } finally {
      userService.getUserById = original;
    }
  });
});

// ── P3: reminders + event wiring ──
const reminderCron = await import('../src/features/invoice/invoiceReminder.cron.js');
const { invoiceEventEmitter, INVOICE_GENERATED } = await import('../src/features/invoice/invoice.events.js');
await import('../src/features/invoice/invoice.listeners.js');

describe('reminders and event wiring', () => {
  const outbox = [];
  before(() => {
    messageTemplateService.getTemplateByPurpose = async () => null; // defaults only
    emailMod.setEmailSender(async (org, to, subject) => {
      outbox.push({ to, subject });
      return true;
    });
  });
  after(() => emailMod.setEmailSender());
  beforeEach(async () => {
    outbox.length = 0;
    if (dbReady) await Invoice.deleteMany({});
  });

  test('due-soon and recently-overdue invoices get one email each; reruns send nothing', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const day = 86400000;
    await makeInvoice({ invoiceNumber: 'DUE-SOON', dueDate: new Date(Date.now() + 2 * day) });
    await makeInvoice({ invoiceNumber: 'DUE-LATER', dueDate: new Date(Date.now() + 10 * day) });
    await makeInvoice({ invoiceNumber: 'OVERDUE-NEW', dueDate: new Date(Date.now() - 2 * day) });
    await makeInvoice({ invoiceNumber: 'OVERDUE-OLD', dueDate: new Date(Date.now() - 40 * day) });
    await makeInvoice({ invoiceNumber: 'PAID', status: 'PAID', outstandingAmount: 0, dueDate: new Date(Date.now() + day) });

    assert.deepEqual(await reminderCron.runInvoiceReminders(), { reminders: 1, overdue: 1 });
    await emailMod.drainInvoiceEmailQueue();
    const subjects = outbox.map((m) => m.subject).sort();
    assert.equal(subjects.length, 2);
    assert.match(subjects.find((s) => s.startsWith('Overdue')), /OVERDUE-NEW/);
    assert.match(subjects.find((s) => s.startsWith('Reminder')), /DUE-SOON/);

    assert.deepEqual(await reminderCron.runInvoiceReminders(), { reminders: 0, overdue: 0 });
  });

  test('INVOICE_GENERATED event sends the invoice email', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ invoiceNumber: 'EVT-1' });
    invoiceEventEmitter.emit(INVOICE_GENERATED, { invoiceId: id });
    await new Promise((r) => setTimeout(r, 50));
    await emailMod.drainInvoiceEmailQueue();
    assert.equal(outbox.length, 1);
    assert.match(outbox[0].subject, /New invoice EVT-1/);
  });
});

// ── P4: public pay-online endpoint over HTTP ──
describe('GET /api/billing-links/:token/pay', () => {
  let server;
  let base;
  before(async () => {
    const express = (await import('express')).default;
    const { default: router } = await import('../src/features/invoice/invoicePayLink.router.js');
    const app = express();
    app.use('/api/billing-links', router);
    await new Promise((r) => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api/billing-links`;
  });
  after(() => server?.close());

  test('redirects to a fresh gateway link for an unpaid invoice', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice();
    const token = payLink.signPayToken({ _id: id, orgId });
    const res = await fetch(`${base}/${token}/pay`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location'), /^https:\/\/rzp\.io\/l\//);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  test('shows "already paid" instead of charging a paid invoice', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ status: 'PAID', outstandingAmount: 0 });
    const res = await fetch(`${base}/${payLink.signPayToken({ _id: id, orgId })}/pay`, { redirect: 'manual' });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /already paid/);
  });

  test('invalid or expired token gets a 410 page', async () => {
    const res = await fetch(`${base}/not-a-token/pay`, { redirect: 'manual' });
    assert.equal(res.status, 410);
    assert.match(await res.text(), /expired/);
  });
});

// ── P4: a Payment Link payment settles the invoice through the live webhook ──
const { default: unifiedPaymentService } = await import('../src/features/payment/unifiedPayment.service.js');
const { default: Payment } = await import('../src/features/payment/payment.model.js');

describe('payment_link.paid webhook', () => {
  const outbox = [];
  const prevEnv = process.env.NODE_ENV;
  before(() => {
    process.env.NODE_ENV = 'test'; // processWebhook skips HMAC verification in test
    messageTemplateService.getTemplateByPurpose = async () => null;
    emailMod.setEmailSender(async (org, to, subject) => { outbox.push({ to, subject }); return true; });
  });
  after(() => { process.env.NODE_ENV = prevEnv; emailMod.setEmailSender(); });
  beforeEach(() => { outbox.length = 0; cancelled.length = 0; });

  const linkEvent = (invoiceId, payId, { form = 'payment_link.paid', amountPaise = 150000 } = {}) => {
    const notes = { invoiceId: String(invoiceId), orgId: String(orgId) };
    const paymentEntity = { id: payId, amount: amountPaise, currency: 'INR', status: 'captured', order_id: `order_${payId}`, method: 'upi', notes };
    const body = form === 'payment_link.paid'
      ? { event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_1', reference_id: `${invoiceId}-1`, amount: amountPaise, amount_paid: amountPaise, notes, status: 'paid' } }, payment: { entity: paymentEntity } } }
      : { event: 'payment.captured', payload: { payment: { entity: paymentEntity } } };
    return unifiedPaymentService.processWebhook(JSON.stringify(body), 'sig', { 'x-razorpay-event-id': `evt_${payId}` });
  };

  test('settles the invoice, records the payment once, retires the link and emails a receipt', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ invoiceNumber: 'LINK-1' });
    await payLink.ensureFreshPaymentLink(id); // the link the resident clicked

    const res = await linkEvent(id, 'pay_LINK1');
    assert.equal(res.success, true);
    const inv = await Invoice.findById(id);
    assert.equal(inv.status, 'PAID');
    assert.equal(inv.outstandingAmount, 0);
    assert.equal(await Payment.countDocuments({ gatewayTransactionId: 'pay_LINK1', status: 'success' }), 1);

    const dup = await linkEvent(id, 'pay_LINK1');
    assert.equal(dup.success, true);
    assert.equal(await Payment.countDocuments({ gatewayTransactionId: 'pay_LINK1' }), 1, 'duplicate webhook is idempotent');

    await new Promise((r) => setTimeout(r, 2000));
    await emailMod.drainInvoiceEmailQueue();
    assert.equal(cancelled.length, 1, 'stale Razorpay link cancelled after payment');
    assert.equal((await Invoice.findById(id)).paymentLinkStatus, 'PAID');
    assert.ok(outbox.some((m) => /Payment received/.test(m.subject)), 'receipt email sent');
  });

  test('the payment.captured form of a link payment also settles', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ invoiceNumber: 'LINK-2' });
    const res = await linkEvent(id, 'pay_LINK2', { form: 'payment.captured' });
    assert.equal(res.success, true);
    assert.equal((await Invoice.findById(id)).status, 'PAID');
  });

  test('a partial link payment leaves the balance outstanding', async (t) => {
    if (!dbReady) return t.skip('local MongoDB not available');
    const id = await makeInvoice({ invoiceNumber: 'LINK-3' });
    await linkEvent(id, 'pay_LINK3', { amountPaise: 50000 });
    const inv = await Invoice.findById(id);
    assert.equal(inv.status, 'PARTIALLY_PAID');
    assert.equal(inv.outstandingAmount, 1000);
  });
});

// ── Message template rules for billing purposes ──
describe('billing template validation', () => {
  const run = async (bodyFields) => {
    const { validationResult } = await import('express-validator');
    const { createTemplateRules } = await import('../src/features/messageTemplate/messageTemplate.validateRules.js');
    const req = { body: { name: 'Billing email', type: 'email', subject: 'Subject', ...bodyFields }, params: {}, query: {} };
    for (const rule of createTemplateRules) await rule.run(req);
    return validationResult(req).array().map((e) => e.msg);
  };

  test('billing purposes are accepted', async () => {
    for (const purpose of ['invoice_generated', 'invoice_reminder', 'invoice_overdue']) {
      assert.deepEqual(await run({ purpose, body: '<a href="{{app_link}}">Pay</a>' }), [], purpose);
    }
    assert.deepEqual(await run({ purpose: 'invoice_receipt', body: 'Thanks {{resident_name}}' }), []);
  });

  test('invoice emails must keep {{app_link}} and be email-only', async () => {
    assert.ok((await run({ purpose: 'invoice_generated', body: 'no link' })).some((m) => /app_link/.test(m)));
    assert.ok((await run({ purpose: 'invoice_reminder', type: 'sms', body: '{{app_link}}' })).some((m) => /email-only/.test(m)));
  });
});
