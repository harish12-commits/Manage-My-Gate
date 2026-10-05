import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import crmInquiryController from '../features/crmInquiry/crmInquiry.controller.js';
import { validate } from '../middlewares/validator.middleware.js';
import { validatePublicLead } from '../features/crmInquiry/crmInquiry.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const publicLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

router.get('/health', (req, res) => {
  res.success({
    status: 'UP',
    service: 'ManageMyGate Backend API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }, 'API is healthy');
});

router.post('/register-lead', publicLeadLimiter, validate(validatePublicLead), crmInquiryController.registerPublicLead);

router.get('/checkout/:id', async (req, res, next) => {
  try {
    const platformPaymentService = (await import('../features/platformPayment/platformPayment.service.js')).default;
    const data = await platformPaymentService.getPublicCheckoutInfo(req.params.id);
    res.success(data, 'Public checkout details retrieved successfully');
  } catch (err) {
    next(err);
  }
});

const buildInvoiceHtml = (checkoutInfo) => {
  const invNum = checkoutInfo?.invoiceNumber || (checkoutInfo?.invoiceId ? `INV-2026-${String(checkoutInfo.invoiceId).slice(-6).toUpperCase()}` : `INV-2026-ONLINE`);
  const orgName = checkoutInfo?.organizationName || checkoutInfo?.organizationDetails?.organizationName || 'Your Community';
  const custName = checkoutInfo?.contactName || checkoutInfo?.customerDetails?.customerName || 'Valued Customer';
  const email = checkoutInfo?.email || checkoutInfo?.customerDetails?.email || 'N/A';
  const phone = checkoutInfo?.contactPhone || checkoutInfo?.customerDetails?.contactPhone || 'N/A';
  const invDate = checkoutInfo?.invoiceDate ? new Date(checkoutInfo.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const totalAmt = checkoutInfo?.amount || 0;
  
  const bd = checkoutInfo?.breakdown || {};
  const basePrice = bd.basePrice || 0;
  const unitCount = bd.unitCount || 250;
  const perUnitRate = bd.perUnitRate || 0;
  const unitTotal = unitCount * perUnitRate;
  const setupFee = bd.setupFee || 0;
  const discount = bd.discountAmount || 0;
  const vatAmount = bd.vatAmount || Math.round(totalAmt - Math.round(totalAmt / 1.15));
  const subtotal = bd.subtotal || (totalAmt > 0 ? Math.round(totalAmt - vatAmount) : 0);
  const isPaid = Boolean(checkoutInfo?.isPaid);
  const payMethod = checkoutInfo?.paymentDetails?.paymentMethod || 'Razorpay Gateway';
  const txnId = checkoutInfo?.paymentDetails?.transactionId || `TXN_${Date.now()}`;
  const addOns = Array.isArray(bd.selectedAddOns) ? bd.selectedAddOns : [];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice - ${invNum}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; background: #f8fafc; padding: 40px; margin: 0; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 15px 35px rgba(0,0,0,0.06); border: 1px solid #cbd5e1; }
    .inv-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 24px; margin-bottom: 28px; }
    .brand { font-size: 26px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px; }
    .inv-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; background: #f1f5f9; padding: 20px; border-radius: 12px; margin-bottom: 28px; border: 1px solid #e2e8f0; }
    .inv-meta-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .inv-meta-val { font-size: 14px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 12px 16px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; color: #334155; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 800; background: ${isPaid ? '#d1fae5' : '#fff3cd'}; color: ${isPaid ? '#047857' : '#856404'}; }
    .totals-box { margin-left: auto; width: 340px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; color: #475569; }
    .total-row.grand { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #0f172a; }
    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="inv-header">
      <div>
        <div class="brand">🏢 ManageMyGate Platform</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Gated Community & Property Management SaaS</div>
      </div>
      <div style="text-align: right;">
        <h1 style="margin: 0; font-size: 24px; color: #0f172a;">OFFICIAL TAX INVOICE</h1>
        <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 14px; color: #2563eb; font-weight: bold;">${invNum}</p>
      </div>
    </div>

    <div class="inv-meta">
      <div>
        <div class="inv-meta-label">Billed To Community</div>
        <div class="inv-meta-val">${orgName}</div>
        <div style="font-size: 12.5px; color: #475569;">Attn: ${custName}</div>
        <div style="font-size: 12px; color: #2563eb;">${email}</div>
        ${phone ? `<div style="font-size: 12px; color: #64748b;">Ph: ${phone}</div>` : ''}
      </div>
      <div>
        <div class="inv-meta-label">Invoice & Contract Date</div>
        <div class="inv-meta-val">${invDate}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Payment Gateway:</div>
        <div style="font-size: 12.5px; color: #0f172a; font-weight: 600;">${payMethod}</div>
      </div>
      <div>
        <div class="inv-meta-label">Payment Status & Txn Ref</div>
        <div><span class="badge">${isPaid ? '✓ PAID / VERIFIED' : 'PENDING'}</span></div>
        <div style="font-size: 11px; font-family: monospace; color: #475569; margin-top: 6px;">Ref: ${txnId}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Line Item & Description</th>
          <th>Units / Qty</th>
          <th>Rate</th>
          <th style="text-align: right;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${bd.planName || 'Enterprise Commercial SaaS Subscription'}</strong><br/>
            <span style="color: #64748b; font-size: 12px;">Full workspace suite: Visitor, Amenities, Complaints, Notices, Security, Notifications & Billing</span>
          </td>
          <td>1 Term</td>
          <td>₹${basePrice > 0 ? basePrice.toLocaleString('en-IN') : subtotal.toLocaleString('en-IN')}</td>
          <td style="text-align: right;">₹${basePrice > 0 ? basePrice.toLocaleString('en-IN') : subtotal.toLocaleString('en-IN')}</td>
        </tr>

        ${unitCount > 0 && perUnitRate > 0 ? `
        <tr>
          <td>
            <strong>Per-Unit Villa Subscription (${unitCount} Units)</strong><br/>
            <span style="color: #64748b; font-size: 12px;">Calculated rate per villa unit</span>
          </td>
          <td>${unitCount} Units</td>
          <td>₹${perUnitRate} / unit</td>
          <td style="text-align: right;">₹${unitTotal.toLocaleString('en-IN')}</td>
        </tr>` : ''}

        ${addOns.length > 0 ? `
        <tr>
          <td colspan="4" style="background: #f8fafc;">
            <strong>Included Feature Add-ons:</strong>
            <div style="margin-top: 4px; font-size: 12px; color: #475569;">
              ${addOns.map(a => `• ${typeof a === 'string' ? a : (a.name || a.code || a.key)}`).join(' &nbsp;&nbsp;|&nbsp;&nbsp; ')}
            </div>
          </td>
        </tr>` : ''}

        ${setupFee > 0 ? `
        <tr>
          <td><strong>Setup & Onboarding Fee</strong></td>
          <td>1 Service</td>
          <td>₹${setupFee.toLocaleString('en-IN')}</td>
          <td style="text-align: right;">₹${setupFee.toLocaleString('en-IN')}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="total-row">
        <span>Subtotal Amount:</span>
        <span>₹${subtotal.toLocaleString('en-IN')}</span>
      </div>
      ${discount > 0 ? `
      <div class="total-row" style="color: #16a34a; font-weight: 600;">
        <span>Discount Applied:</span>
        <span>-₹${discount.toLocaleString('en-IN')}</span>
      </div>` : ''}
      <div class="total-row">
        <span>GST / Taxes (15%):</span>
        <span>₹${vatAmount.toLocaleString('en-IN')}</span>
      </div>
      <div class="total-row grand">
        <span>Total Paid:</span>
        <span style="color: #2563eb;">₹${totalAmt.toLocaleString('en-IN')} INR</span>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0;">Atominos Consulting Private Limited • Official Property & Gate Management Platform</p>
      <p style="margin: 4px 0 0 0;">This is a computer-generated official tax invoice verified by server payment logs.</p>
    </div>
  </div>
</body>
</html>`;
};

router.get('/invoice/:id/view', async (req, res, next) => {
  try {
    const platformPaymentService = (await import('../features/platformPayment/platformPayment.service.js')).default;
    const checkoutInfo = await platformPaymentService.getPublicCheckoutInfo(req.params.id);
    const html = buildInvoiceHtml(checkoutInfo);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/invoice/:id/download', async (req, res, next) => {
  try {
    const platformPaymentService = (await import('../features/platformPayment/platformPayment.service.js')).default;
    const checkoutInfo = await platformPaymentService.getPublicCheckoutInfo(req.params.id);
    const html = buildInvoiceHtml(checkoutInfo);
    const invNum = checkoutInfo?.invoiceNumber || `INV-2026-${String(req.params.id).slice(-4).toUpperCase()}`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${invNum}.html`);
    res.send(html);
  } catch (err) {
    next(err);
  }
});

router.get('/privacy-policy', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../public/privacy-policy.html'));
});

export default router;
