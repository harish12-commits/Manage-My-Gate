import jwt from 'jsonwebtoken';
import config from '../../config/config.js';
import logger from '../../utils/logger.utils.js';
import Invoice from './invoice.model.js';
import paymentService from '../payment/payment.service.js';
import userService from '../user/user.services.js';

/**
 * Invoice links sent outside the app (email / WhatsApp).
 *
 * - appUrl: universal link (https://<domain>/billing/invoice/<id>) — opens the invoice in the
 *   app; without the app the web page offers store links and "pay online".
 * - payUrl: /api/billing-links/<token>/pay — resolved at click time, so it never charges a
 *   stale amount and never charges a paid invoice (see ensureFreshPaymentLink).
 *
 * Tokens are signed with a key derived from JWT_SECRET, scoped to one invoice, and can never
 * be used as an auth token (different key + `typ`).
 */

const TOKEN_TYPE = 'invoice_pay';
const TOKEN_TTL = '120d';
const LINK_REUSE_MIN_REMAINING_MS = 60 * 60 * 1000; // regenerate when < 1h left

const tokenSecret = () => {
  if (!config.jwt?.secret) throw new Error('JWT_SECRET is not configured');
  return `${config.jwt.secret}:${TOKEN_TYPE}`;
};

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const publicBaseUrl = () =>
  (process.env.PUBLIC_APP_URL || `https://${config.mobile?.universalLinkDomain || 'app.managemygate.com'}`).replace(/\/+$/, '');

export const signPayToken = (invoice) =>
  jwt.sign(
    { sub: String(invoice._id), org: String(invoice.orgId || invoice.communityId || ''), typ: TOKEN_TYPE },
    tokenSecret(),
    { expiresIn: TOKEN_TTL, algorithm: 'HS256' }
  );

/** @returns {{ invoiceId: string, orgId: string } | null} */
export const verifyPayToken = (token) => {
  try {
    const decoded = jwt.verify(String(token || ''), tokenSecret(), { algorithms: ['HS256'] });
    if (decoded?.typ !== TOKEN_TYPE || !decoded.sub) return null;
    return { invoiceId: decoded.sub, orgId: decoded.org };
  } catch {
    return null;
  }
};

export const buildInvoiceLinks = (invoice) => {
  const base = publicBaseUrl();
  const token = signPayToken(invoice);
  return {
    appUrl: `${base}/billing/invoice/${invoice._id}?t=${encodeURIComponent(token)}`,
    payUrl: `${base}/api/billing-links/${encodeURIComponent(token)}/pay`,
    token,
  };
};

export const outstandingOf = (invoice) => round2(invoice.outstandingAmount ?? invoice.totalDue ?? invoice.totalAmount ?? 0);

/**
 * Link state for an invoice right now.
 * @returns {Promise<{ state: 'ACTIVE'|'PAID'|'CANCELLED'|'VERIFICATION_PENDING'|'NOT_FOUND', url?: string, invoice?: object }>}
 */
export async function ensureFreshPaymentLink(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return { state: 'NOT_FOUND' };
  if (invoice.status === 'CANCELLED') return { state: 'CANCELLED', invoice };

  const outstanding = outstandingOf(invoice);
  if (invoice.status === 'PAID' || outstanding <= 0) return { state: 'PAID', invoice };
  // A bank transfer is under review: don't invite a second payment for the same dues.
  if (invoice.status === 'VERIFICATION_PENDING') return { state: 'VERIFICATION_PENDING', invoice };

  const stillValid =
    invoice.paymentLink &&
    invoice.paymentLinkStatus === 'ACTIVE' &&
    round2(invoice.paymentLinkAmount) === outstanding &&
    (!invoice.paymentLinkExpiresAt || invoice.paymentLinkExpiresAt.getTime() - Date.now() > LINK_REUSE_MIN_REMAINING_MS);
  if (stillValid) return { state: 'ACTIVE', url: invoice.paymentLink, invoice };

  const orgId = invoice.orgId || invoice.communityId;
  if (invoice.paymentLinkId && invoice.paymentLinkStatus === 'ACTIVE') {
    await paymentService.cancelPaymentLink(orgId, invoice.paymentLinkId);
  }

  const targetUserId = invoice.targetUserId?._id || invoice.targetUserId;
  const user = (await userService.getUserById(targetUserId).catch(() => null)) || { _id: targetUserId };
  const previousCount = invoice.paymentLinkRegeneratedCount || 0;
  const attempt = invoice.paymentLinkId ? previousCount + 1 : previousCount;
  const link = await paymentService.createPaymentLink(invoice, user, { amount: outstanding, attempt });

  // Optimistic claim: if another click regenerated first, keep theirs and cancel ours.
  const updated = await Invoice.findOneAndUpdate(
    { _id: invoice._id, paymentLinkGeneratedAt: invoice.paymentLinkGeneratedAt ?? null },
    {
      $set: {
        paymentLinkId: link.id,
        paymentLink: link.url,
        paymentLinkStatus: 'ACTIVE',
        paymentLinkAmount: link.amount,
        paymentLinkGeneratedAt: new Date(),
        paymentLinkExpiresAt: link.expiresAt,
        paymentLinkRegeneratedCount: attempt,
      },
    },
    { new: true }
  );
  if (!updated) {
    await paymentService.cancelPaymentLink(orgId, link.id);
    const winner = await Invoice.findById(invoice._id);
    return winner?.paymentLink ? { state: 'ACTIVE', url: winner.paymentLink, invoice: winner } : { state: 'NOT_FOUND' };
  }
  logger.info('Invoice payment link issued', { invoiceId: String(invoice._id), amount: link.amount, attempt });
  return { state: 'ACTIVE', url: link.url, invoice: updated };
}

/** Called after any successful payment: the old link's amount is now wrong (or the invoice is paid). */
export async function retireActivePaymentLink(invoiceId) {
  const invoice = await Invoice.findById(invoiceId).select('orgId communityId status paymentLinkId paymentLinkStatus');
  if (!invoice || invoice.paymentLinkStatus !== 'ACTIVE') return false;
  await paymentService.cancelPaymentLink(invoice.orgId || invoice.communityId, invoice.paymentLinkId);
  await Invoice.updateOne(
    { _id: invoice._id, paymentLinkStatus: 'ACTIVE' },
    { $set: { paymentLinkStatus: invoice.status === 'PAID' ? 'PAID' : 'CANCELLED' } }
  );
  return true;
}

export default {
  publicBaseUrl,
  signPayToken,
  verifyPayToken,
  buildInvoiceLinks,
  outstandingOf,
  ensureFreshPaymentLink,
  retireActivePaymentLink,
};
