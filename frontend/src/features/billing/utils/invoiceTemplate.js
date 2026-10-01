/**
 * invoiceTemplate.js
 *
 * Generates a professional HTML invoice/receipt and opens it in a
 * new tab for printing / Save-as-PDF.
 *
 * @param {Object} item       – The invoice data object (from unitBreakdown or recentInvoices).
 * @param {Object} [options]  – Optional overrides { communityName, communityAddress }.
 */
export function openInvoicePrintWindow(item, options = {}) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const communityName = options.communityName || 'ManageMyGate Community'
  const communityAddress = options.communityAddress || ''

  // ── Core fields ──────────────────────────────────────────────────────
  const invoiceNum = item.invoiceNumber || item.invoiceId || item._id || '—'
  const unitNumber = item.unitNumber || '—'
  const unitType = item.type || ''
  const billingPeriod = item.billingPeriodString || '—'
  const assessmentName = item.assessmentName || 'Maintenance'
  const residentName = item.residentName || options.userName || '—'
  const residentType = item.residentType || 'Resident'
  const status = (item.status || 'UNKNOWN').replace(/_/g, ' ')
  const invoiceDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  // ── Financial fields ─────────────────────────────────────────────────
  const currentCharge = item.currentCharge || item.totalDue || 0
  const previousOutstanding = item.previousOutstanding || 0
  const lateFee = item.lateFeeAmount || 0
  const totalDue = item.totalDue || 0
  const paidAmount = item.paidAmount || 0
  const outstanding = item.outstandingAmount ?? totalDue
  const alreadyPaidAmount = item.alreadyPaidAmount || 0
  const currentPaymentAmount = item.currentPaymentAmount || 0

  // ── Payment details ──────────────────────────────────────────────────
  const paymentMethod = item.paymentMethod || '—'
  const offlineRef = item.offlineReference || '—'
  const paidAt = item.paid_at
    ? new Date(item.paid_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  // ── Status pill colour ───────────────────────────────────────────────
  let statusBg = '#F1F5F9'
  let statusColor = '#64748B'
  let statusBorder = '#E2E8F0'
  if (item.status === 'PAID') {
    statusBg = '#D1FAE5'
    statusColor = '#065F46'
    statusBorder = '#86EFAC'
  } else if (item.status === 'PARTIALLY_PAID') {
    statusBg = '#FEF3C7'
    statusColor = '#92400E'
    statusBorder = '#FCD34D'
  } else if (item.status === 'UNPAID' || item.status === 'OVERDUE') {
    statusBg = '#FEE2E2'
    statusColor = '#991B1B'
    statusBorder = '#FCA5A5'
  }

  // ── Build line-item rows ─────────────────────────────────────────────
  let lineItemsHTML = ''
  if (currentCharge > 0) {
    lineItemsHTML += `
      <tr>
        <td style="padding:12px 16px;color:#1e293b;">${assessmentName} (${billingPeriod})</td>
        <td style="padding:12px 16px;color:#1e293b;text-align:right;">₹${currentCharge.toLocaleString('en-IN')}</td>
      </tr>`
  }
  if (previousOutstanding > 0) {
    lineItemsHTML += `
      <tr>
        <td style="padding:12px 16px;color:#1e293b;">Previous Outstanding Carry-Forward</td>
        <td style="padding:12px 16px;color:#1e293b;text-align:right;">₹${previousOutstanding.toLocaleString('en-IN')}</td>
      </tr>`
  }
  if (lateFee > 0) {
    lineItemsHTML += `
      <tr>
        <td style="padding:12px 16px;color:#1e293b;">Late Fee / Penalty</td>
        <td style="padding:12px 16px;color:#1e293b;text-align:right;">₹${lateFee.toLocaleString('en-IN')}</td>
      </tr>`
  }
  // fallback: if no line items at all, show a single row
  if (!lineItemsHTML) {
    lineItemsHTML = `
      <tr>
        <td style="padding:12px 16px;color:#1e293b;">${assessmentName} (${billingPeriod})</td>
        <td style="padding:12px 16px;color:#1e293b;text-align:right;">₹${totalDue.toLocaleString('en-IN')}</td>
      </tr>`
  }

  // ── Payment settlement section (only if payment was made) ────────────
  let settlementHTML = ''
  if (paidAmount > 0 && paymentMethod && paymentMethod !== '—') {
    settlementHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:10px;margin-bottom:32px;">
        <h3 style="font-size:12px;font-weight:700;color:#334155;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:1px;">
          Payment Settlement Details
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:14px;">
          <div>
            <div style="font-size:11px;color:#94a3b8;">Transaction / Reference</div>
            <div style="font-weight:600;color:#334155;margin-top:3px;font-family:monospace;">${offlineRef !== '—' ? offlineRef : invoiceNum}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#94a3b8;">Payment Date</div>
            <div style="font-weight:600;color:#334155;margin-top:3px;">${paidAt}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#94a3b8;">Payment Method</div>
            <div style="font-weight:600;color:#334155;margin-top:3px;">${paymentMethod}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#94a3b8;">Settled To</div>
            <div style="font-weight:600;color:#334155;margin-top:3px;">${communityName}</div>
          </div>
        </div>
      </div>`
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${invoiceNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; }
    @media print {
      body { padding: 0; }
      .invoice-container { box-shadow: none !important; border: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-container" style="max-width:800px;margin:0 auto;padding:40px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,.06);">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #e2e8f0;">
      <div>
        <h1 style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;margin:0;">Invoice / Receipt</h1>
        <p style="font-size:13px;color:#94a3b8;margin-top:4px;">Generated from ManageMyGate</p>
      </div>
      <div style="text-align:right;">
        <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0;">${communityName}</h2>
        ${communityAddress ? `<p style="font-size:13px;color:#94a3b8;margin-top:2px;">${communityAddress}</p>` : ''}
      </div>
    </div>

    <!-- Meta Information -->
    <div style="display:flex;justify-content:space-between;margin-bottom:32px;">
      <div>
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Billed To</p>
        <p style="font-size:18px;font-weight:700;color:#1e293b;">${residentName}</p>
        <p style="font-size:13px;color:#475569;margin-top:3px;">Unit: ${unitNumber}${unitType ? ' (' + unitType + ')' : ''}</p>
        <p style="font-size:13px;color:#475569;margin-top:2px;">Resident Type: ${residentType}</p>
      </div>
      <div style="text-align:right;">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Invoice Details</p>
        <p style="font-size:13px;color:#1e293b;"><span style="font-weight:600;color:#64748b;">Invoice #:</span> ${invoiceNum}</p>
        <p style="font-size:13px;color:#1e293b;margin-top:2px;"><span style="font-weight:600;color:#64748b;">Billing Period:</span> ${billingPeriod}</p>
        <p style="font-size:13px;color:#1e293b;margin-top:2px;"><span style="font-weight:600;color:#64748b;">Invoice Date:</span> ${invoiceDate}</p>
        <div style="display:inline-block;margin-top:10px;padding:4px 14px;background:${statusBg};color:${statusColor};font-weight:700;font-size:11px;border-radius:50px;border:1px solid ${statusBorder};">
          STATUS: ${status}
        </div>
      </div>
    </div>

    <!-- Itemized Billing Table -->
    <div style="margin-bottom:32px;">
      <table style="width:100%;text-align:left;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
            <th style="padding:12px 16px;font-size:12px;font-weight:600;color:#64748b;">Description</th>
            <th style="padding:12px 16px;font-size:12px;font-weight:600;color:#64748b;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody style="font-size:14px;">
          ${lineItemsHTML}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #e2e8f0;">
            <td style="padding:12px 16px;font-weight:600;color:#64748b;text-align:right;">Total Due Billed:</td>
            <td style="padding:12px 16px;font-weight:700;color:#1e293b;text-align:right;">₹${totalDue.toLocaleString('en-IN')}</td>
          </tr>
          ${
            alreadyPaidAmount > 0
              ? `
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;font-weight:600;color:#64748b;text-align:right;">Already Paid Amount:</td>
            <td style="padding:12px 16px;font-weight:700;color:#065f46;text-align:right;">-₹${alreadyPaidAmount.toLocaleString('en-IN')}</td>
          </tr>
          `
              : ''
          }
          ${
            currentPaymentAmount > 0
              ? `
          <tr style="background:#f0fdf4;">
            <td style="padding:12px 16px;font-weight:600;color:#64748b;text-align:right;">Current Amount Paid:</td>
            <td style="padding:12px 16px;font-weight:700;color:#065f46;text-align:right;">-₹${currentPaymentAmount.toLocaleString('en-IN')}</td>
          </tr>
          `
              : `
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;font-weight:600;color:#64748b;text-align:right;">Amount Paid:</td>
            <td style="padding:12px 16px;font-weight:700;color:#065f46;text-align:right;">-₹${paidAmount.toLocaleString('en-IN')}</td>
          </tr>
          `
          }
          <tr style="border-top:3px solid #1e293b;background:#f1f5f9;">
            <td style="padding:16px;font-weight:800;color:#0f172a;text-align:right;font-size:16px;text-transform:uppercase;">Outstanding Balance:</td>
            <td style="padding:16px;font-weight:800;color:#0f172a;text-align:right;font-size:20px;">₹${outstanding.toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Payment Settlement Details -->
    ${settlementHTML}

    <!-- Footer -->
    <div style="text-align:center;font-size:12px;color:#94a3b8;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
      <p>This is a computer-generated document and does not require a physical signature.</p>
      <p style="margin-top:6px;color:#64748b;font-weight:500;">Thank you for your timely payments!</p>
    </div>

  </div>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
