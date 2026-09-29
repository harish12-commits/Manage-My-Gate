import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from '../../utils/logger.utils.js';
import { verifyPayToken, ensureFreshPaymentLink, publicBaseUrl } from './invoicePayLink.service.js';

/**
 * Public (no login) "Pay online" endpoint used by invoice emails / WhatsApp.
 * GET /api/billing-links/:token/pay → 302 to a Razorpay link for the CURRENT outstanding amount,
 * or a small status page when the invoice is paid / under review / the link is invalid.
 */
const router = express.Router();

const payLinkLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const renderStatusPage = ({ title, message, invoiceId }) => {
  const appLink = invoiceId ? `${publicBaseUrl()}/billing/invoice/${encodeURIComponent(invoiceId)}` : publicBaseUrl();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f4f1;color:#1c1917;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
.card{background:#fff;border-radius:20px;padding:28px;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.06);text-align:center}
h1{font-size:20px;margin:0 0 8px}p{color:#57534e;line-height:1.5;margin:0 0 20px}
a{display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600}</style></head>
<body><div class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(appLink)}">Open in the app</a></div></body></html>`;
};

router.get('/:token/pay', payLinkLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  const claims = verifyPayToken(req.params.token);
  if (!claims) {
    return res.status(410).type('html').send(renderStatusPage({
      title: 'This payment link has expired',
      message: 'Open the app to see your latest dues and pay securely.',
    }));
  }

  try {
    const result = await ensureFreshPaymentLink(claims.invoiceId);
    if (result.state === 'ACTIVE' && result.url) return res.redirect(302, result.url);

    const pages = {
      PAID: ['This invoice is already paid', 'Thank you — no payment is due. Your receipt is in the app.'],
      VERIFICATION_PENDING: ['Payment under review', 'A bank transfer for this invoice is being verified by your community. No further payment is needed right now.'],
      CANCELLED: ['This invoice was cancelled', 'No payment is due. Contact your community office if you have questions.'],
      NOT_FOUND: ['Invoice not found', 'Open the app to see your latest dues.'],
    };
    const [title, message] = pages[result.state] || pages.NOT_FOUND;
    return res.status(result.state === 'NOT_FOUND' ? 404 : 200).type('html').send(renderStatusPage({ title, message, invoiceId: claims.invoiceId }));
  } catch (error) {
    logger.error('Pay-online link failed', { invoiceId: claims.invoiceId, error: error.message });
    return res.status(502).type('html').send(renderStatusPage({
      title: 'Online payment is unavailable right now',
      message: 'Please try again in a few minutes, or pay from the app.',
      invoiceId: claims.invoiceId,
    }));
  }
});

export default router;
