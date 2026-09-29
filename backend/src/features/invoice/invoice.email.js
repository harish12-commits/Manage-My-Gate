import logger from '../../utils/logger.utils.js';
import { sendEmail } from '../../utils/email.utils.js';
import Invoice from './invoice.model.js';
import userService from '../user/user.services.js';
import messageTemplateService from '../messageTemplate/messageTemplate.service.js';
import { buildInvoiceLinks, outstandingOf } from './invoicePayLink.service.js';

/**
 * Resident billing emails, sent from the community's own SMTP (Integration Hub),
 * falling back to the platform SMTP. Each email is at most once per invoice
 * (emailLog claim) and receipts are once per payment.
 *
 * Communities can override any email with a Message Template (type 'email',
 * purpose invoice_generated | invoice_reminder | invoice_overdue | invoice_receipt)
 * using the {{placeholders}} listed in PLACEHOLDERS.
 */

export const EMAIL_KINDS = {
  generated: { purpose: 'invoice_generated', logField: 'generatedSentAt' },
  reminder: { purpose: 'invoice_reminder', logField: 'reminderSentAt' },
  overdue: { purpose: 'invoice_overdue', logField: 'overdueSentAt' },
  receipt: { purpose: 'invoice_receipt', logField: null },
};

export const PLACEHOLDERS = [
  'resident_name', 'community_name', 'invoice_number', 'billing_period', 'amount_due',
  'total_amount', 'amount_paid', 'due_date', 'app_link', 'pay_link', 'payment_reference',
];

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatMoney = (amount, currency = 'INR') => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};

const formatDate = (date, timeZone) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: timeZone || 'Asia/Kolkata' });
  } catch {
    return new Date(date).toDateString();
  }
};

/** Replaces {{key}}; values are HTML-escaped (links are escaped too, which keeps them valid). */
export const compileTemplate = (text, vars) =>
  String(text || '').replace(/{{\s*([a-z_]+)\s*}}/g, (m, key) => (key in vars ? escapeHtml(vars[key]) : m));

// ── Default emails ──

const button = (href, label, primary) =>
  `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;${
    primary ? 'background:#ea580c;color:#ffffff;' : 'background:#ffffff;color:#ea580c;border:1px solid #fdba74;'
  }">${label}</a>`;

const layout = ({ heading, intro, rows, showPay, footer }) => `<!doctype html><html><body style="margin:0;background:#f6f4f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:28px">
<tr><td style="font-size:13px;color:#78716c;padding-bottom:6px">{{community_name}}</td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:10px">${heading}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#44403c;padding-bottom:18px">${intro}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f4;border-radius:14px;padding:14px 16px;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="color:#78716c;padding:5px 0">${k}</td><td align="right" style="font-weight:600;padding:5px 0">${v}</td></tr>`).join('')}
</table></td></tr>
<tr><td style="padding-top:22px">${button('{{app_link}}', showPay ? 'View &amp; Pay in App' : 'View in App', true)}</td></tr>
${showPay ? `<tr><td style="padding-top:10px">${button('{{pay_link}}', 'Pay online without the app', false)}</td></tr>
<tr><td style="font-size:12px;color:#a8a29e;padding-top:8px">The online link always charges your current balance and stops working once the invoice is paid.</td></tr>` : ''}
<tr><td style="font-size:12px;color:#a8a29e;padding-top:22px;border-top:1px solid #f0ebe6;margin-top:22px">${footer}</td></tr>
</table></td></tr></table></body></html>`;

const baseRows = [
  ['Invoice', '{{invoice_number}}'],
  ['Billing period', '{{billing_period}}'],
];

export const DEFAULT_TEMPLATES = {
  generated: {
    subject: 'New invoice {{invoice_number}} — {{amount_due}} due {{due_date}}',
    body: layout({
      heading: 'Your new invoice is ready',
      intro: 'Hi {{resident_name}}, your community has issued a new invoice. You can pay it in the app using your wallet balance or any payment method.',
      rows: [...baseRows, ['Amount due', '{{amount_due}}'], ['Due date', '{{due_date}}']],
      showPay: true,
      footer: 'You are receiving this because you are a resident of {{community_name}}.',
    }),
  },
  reminder: {
    subject: 'Reminder: {{amount_due}} due {{due_date}} ({{invoice_number}})',
    body: layout({
      heading: 'Payment due soon',
      intro: 'Hi {{resident_name}}, this is a friendly reminder that your invoice is due on {{due_date}}.',
      rows: [...baseRows, ['Amount due', '{{amount_due}}'], ['Due date', '{{due_date}}']],
      showPay: true,
      footer: 'Already paid? Please ignore this email — it can take a few minutes to update.',
    }),
  },
  overdue: {
    subject: 'Overdue: {{amount_due}} for invoice {{invoice_number}}',
    body: layout({
      heading: 'Your invoice is overdue',
      intro: 'Hi {{resident_name}}, the due date of {{due_date}} has passed. Please pay as soon as possible to avoid late fees.',
      rows: [...baseRows, ['Amount due', '{{amount_due}}'], ['Was due', '{{due_date}}']],
      showPay: true,
      footer: 'Already paid? Please ignore this email — it can take a few minutes to update.',
    }),
  },
  receipt: {
    subject: 'Payment received — {{amount_paid}} for {{invoice_number}}',
    body: layout({
      heading: 'Thank you, payment received',
      intro: 'Hi {{resident_name}}, we have received your payment. Your receipt and full history are in the app.',
      rows: [...baseRows, ['Amount paid', '{{amount_paid}}'], ['Reference', '{{payment_reference}}'], ['Balance remaining', '{{amount_due}}']],
      showPay: false,
      footer: 'Keep this email for your records.',
    }),
  },
};

// ── Sending ──

let deliver = sendEmail;
/** Test hook: replace the SMTP sender (pass nothing to restore). */
export const setEmailSender = (fn) => {
  deliver = fn || sendEmail;
};

const loadContext = async (invoice) => {
  const Organization = (await import('../organization/organization.model.js')).default;
  const orgId = invoice.orgId || invoice.communityId;
  const [org, user] = await Promise.all([
    Organization.findById(orgId).select('name timezone').lean().catch(() => null),
    userService.getUserById(invoice.targetUserId?._id || invoice.targetUserId).catch(() => null),
  ]);
  return { orgId, org, user };
};

export const buildVariables = ({ invoice, org, user, payment }) => {
  const currency = invoice.currency || 'INR';
  const { appUrl, payUrl } = buildInvoiceLinks(invoice);
  return {
    resident_name: user?.name || user?.username || 'Resident',
    community_name: org?.name || 'Your community',
    invoice_number: invoice.invoiceNumber || String(invoice._id).slice(-8).toUpperCase(),
    billing_period: invoice.billingPeriodString || formatDate(invoice.createdAt, org?.timezone),
    amount_due: formatMoney(outstandingOf(invoice), currency),
    total_amount: formatMoney(invoice.totalAmount ?? invoice.totalDue, currency),
    amount_paid: formatMoney(payment?.amount, currency),
    due_date: formatDate(invoice.dueDate, org?.timezone),
    app_link: appUrl,
    pay_link: payUrl,
    payment_reference: payment?.gatewayTransactionId || payment?.offlineReference || String(payment?._id || ''),
  };
};

const resolveTemplate = async (orgId, kind) => {
  try {
    const custom = await messageTemplateService.getTemplateByPurpose(orgId, 'email', EMAIL_KINDS[kind].purpose);
    if (custom?.body && (custom.isActive ?? true)) return { subject: custom.subject || DEFAULT_TEMPLATES[kind].subject, body: custom.body };
  } catch (err) {
    logger.debug?.('No custom billing template; using default', { kind, error: err.message });
  }
  return DEFAULT_TEMPLATES[kind];
};

const isDeliverable = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/**
 * Sends one billing email. Returns 'sent' | 'skipped:<reason>' | 'failed'.
 * @param {'generated'|'reminder'|'overdue'|'receipt'} kind
 * @param {object} [opts] - { payment } for receipts; { force: true } bypasses the once-per-invoice claim (admin manual reminder).
 */
export async function sendInvoiceEmail(kind, invoiceId, opts = {}) {
  const meta = EMAIL_KINDS[kind];
  if (!meta) throw new Error(`Unknown invoice email kind: ${kind}`);

  // Claim first so concurrent triggers (cron + event, retries) never double-send.
  let invoice;
  let claimFilter = null;
  if (meta.logField && !opts.force) {
    claimFilter = { [`emailLog.${meta.logField}`]: null };
    invoice = await Invoice.findOneAndUpdate(
      { _id: invoiceId, ...claimFilter },
      { $set: { [`emailLog.${meta.logField}`]: new Date() } },
      { new: true }
    );
    if (!invoice) return 'skipped:already-sent';
  } else if (kind === 'receipt') {
    const paymentKey = String(opts.payment?._id || opts.payment?.gatewayTransactionId || '');
    if (!paymentKey) return 'skipped:no-payment';
    invoice = await Invoice.findOneAndUpdate(
      { _id: invoiceId, 'emailLog.receiptPaymentIds': { $ne: paymentKey } },
      { $addToSet: { 'emailLog.receiptPaymentIds': paymentKey } },
      { new: true }
    );
    if (!invoice) return 'skipped:already-sent';
    claimFilter = { paymentKey };
  } else {
    invoice = await Invoice.findById(invoiceId);
  }
  if (!invoice) return 'skipped:not-found';

  const release = async () => {
    if (meta.logField && !opts.force) {
      await Invoice.updateOne({ _id: invoice._id }, { $set: { [`emailLog.${meta.logField}`]: null } });
    } else if (kind === 'receipt' && claimFilter?.paymentKey) {
      await Invoice.updateOne({ _id: invoice._id }, { $pull: { 'emailLog.receiptPaymentIds': claimFilter.paymentKey } });
    }
  };

  // Reminders only make sense while money is owed.
  if (kind !== 'receipt' && (invoice.status === 'PAID' || invoice.status === 'CANCELLED' || outstandingOf(invoice) <= 0)) {
    return 'skipped:nothing-due';
  }

  try {
    const { orgId, org, user } = await loadContext(invoice);
    if (!isDeliverable(user?.email)) {
      logger.info('Billing email skipped: resident has no email', { invoiceId: String(invoice._id), kind });
      return 'skipped:no-email';
    }
    const template = await resolveTemplate(orgId, kind);
    const vars = buildVariables({ invoice, org, user, payment: opts.payment });
    const sent = await deliver(orgId, user.email.trim(), compileTemplate(template.subject, vars), compileTemplate(template.body, vars), {
      fromName: org?.name,
    });
    if (!sent) {
      await release(); // SMTP missing/down: allow a later retry (cron/manual resend)
      return 'failed';
    }
    logger.info('Billing email sent', { invoiceId: String(invoice._id), kind });
    return 'sent';
  } catch (error) {
    await release();
    logger.error('Billing email failed', { invoiceId: String(invoice._id), kind, error: error.message });
    return 'failed';
  }
}

// ── Queue: bulk billing runs create hundreds of invoices at once ──

const CONCURRENCY = 3;
const pending = [];
let active = 0;

const pump = () => {
  while (active < CONCURRENCY && pending.length) {
    const job = pending.shift();
    active += 1;
    Promise.resolve()
      .then(job)
      .catch((err) => logger.error('Billing email job crashed', { error: err.message }))
      .finally(() => {
        active -= 1;
        pump();
      });
  }
};

export const enqueueInvoiceEmail = (kind, invoiceId, opts) => {
  pending.push(() => sendInvoiceEmail(kind, invoiceId, opts));
  pump();
};

/** Test helper: resolves when the queue is idle. */
export const drainInvoiceEmailQueue = async () => {
  while (active || pending.length) await new Promise((r) => setTimeout(r, 10));
};

export default { sendInvoiceEmail, enqueueInvoiceEmail, drainInvoiceEmailQueue, compileTemplate, buildVariables, DEFAULT_TEMPLATES };
