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

const DB_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mmg').replace(/\/[^/?]+(\?|$)/, '/mmg_billing_email_test$1');
let dbReady = false;

const created = [];
const cancelled = [];
let linkSeq = 0;

before(async () => {
  try {
    await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.db.dropDatabase();
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
