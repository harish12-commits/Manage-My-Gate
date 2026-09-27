import { Platform, Share, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Invoice } from '../types';

let LegacyFileSystem: any = null;
try {
  LegacyFileSystem = require('expo-file-system/legacy');
} catch (e) {
  try {
    LegacyFileSystem = require('expo-file-system');
  } catch (err) {
    LegacyFileSystem = null;
  }
}

export interface GenerateInvoiceHtmlOptions {
  communityName?: string;
  communityAddress?: string;
  residentName?: string;
}

export interface ExportInvoiceDocumentOptions {
  action?: 'download' | 'print' | 'share';
}

/**
 * Export/Print HTML Statement or Invoice PDF
 * Automatically handles Web browser print/Blob download and Native Mobile file sharing.
 */
export async function exportInvoiceHtmlDocument(
  htmlContent: string,
  filename: string,
  dialogTitle: string = 'Invoice Statement',
  options: ExportInvoiceDocumentOptions = {}
): Promise<void> {
  const action = options.action || 'download';

  if (Platform.OS === 'web') {
    if (action === 'print') {
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            try {
              printWindow.print();
            } catch (e) {
              console.warn('Print window trigger error', e);
            }
          }, 250);
          return;
        }
      } catch (webErr) {
        console.warn('Window open blocked, attempting direct download', webErr);
      }
    }

    // Direct Automatic Blob Download on Web for 'download' action or print fallback
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    } catch (blobErr: any) {
      Alert.alert('Download Error', blobErr?.message || 'Failed to download statement.');
      return;
    }
  }

  // Native Mobile (iOS / Android)
  try {
    const fs = LegacyFileSystem || {};
    const docDir = fs.documentDirectory || fs.cacheDirectory || '';
    const fileUri = `${docDir}${filename}`;

    if (fs.writeAsStringAsync) {
      await fs.writeAsStringAsync(fileUri, htmlContent, {
        encoding: fs.EncodingType?.UTF8 || 'utf8',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle,
          UTI: 'public.html',
        });
        return;
      }
    }

    await Share.share({
      title: dialogTitle,
      message: `${dialogTitle}\n\nInvoice Statement document generated: ${filename}`,
    });
  } catch (err: any) {
    console.error('Failed to export document on mobile:', err);
    Alert.alert('Export Error', err?.message || 'Unable to save invoice document.');
  }
}

/**
 * Mobile HTML Invoice Template Generator
 * Produces an Expo-compatible HTML string for printing or PDF rendering.
 */
export function generateInvoiceHtml(item: Invoice | any, options: GenerateInvoiceHtmlOptions = {}): string {
  const optComm = options.communityName;
  const isGeneric = optComm && (optComm.toLowerCase().includes('managemygate') || optComm.toLowerCase().includes('manage-my-gate'));

  const communityName =
    (!isGeneric && optComm ? optComm : null) ||
    item?.communityName ||
    item?.orgName ||
    item?.organizationName ||
    item?.organization?.name ||
    item?.tenantName ||
    optComm ||
    'Community Workspace';

  const communityAddress = options.communityAddress || '';

  const invoiceNum = item.invoiceNumber || item.invoiceId || item._id || '—';
  const unitNumber = item.unitNumber || '—';
  const unitType = item.type || '';
  const billingPeriod = item.billingPeriodString || '—';
  const assessmentName = item.assessmentName || 'Maintenance';
  const residentName = options.residentName || item.residentName || item.targetUser || '—';
  const status = (item.status || 'UNKNOWN').replace(/_/g, ' ');
  const invoiceDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const currentCharge = item.currentCharge || item.totalDue || item.amount || 0;
  const previousOutstanding = item.previousOutstanding || 0;
  const lateFee = item.lateFeeAmount || 0;
  const totalDue = item.totalDue || item.amount || 0;
  const paidAmount = item.paidAmount || 0;
  const outstanding = item.outstandingAmount !== undefined ? item.outstandingAmount : Math.max(0, totalDue - paidAmount);
  const paymentMethod = item.paymentMethod || '—';
  const offlineRef = item.offlineReference || '—';

  const paidAt = item.paid_at || item.paymentCompletionDate || item.updatedAt
    ? new Date(item.paid_at || item.paymentCompletionDate || item.updatedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  let statusBg = '#F1F5F9';
  let statusColor = '#64748B';
  let statusBorder = '#E2E8F0';

  if (item.status === 'PAID') {
    statusBg = '#D1FAE5';
    statusColor = '#065F46';
    statusBorder = '#86EFAC';
  } else if (item.status === 'PARTIALLY_PAID' || item.status === 'VERIFICATION_PENDING') {
    statusBg = '#FEF3C7';
    statusColor = '#92400E';
    statusBorder = '#FCD34D';
  } else if (item.status === 'UNPAID' || item.status === 'OVERDUE' || item.status === 'REJECTED') {
    statusBg = '#FEE2E2';
    statusColor = '#991B1B';
    statusBorder = '#FCA5A5';
  }

  // Build Payment Settlement Section if payment was made
  let settlementHTML = '';
  if (paidAmount > 0 || (paymentMethod && paymentMethod !== '—')) {
    settlementHTML = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px; border-radius:10px; margin-bottom:20px;">
      <div style="font-size:11px; font-weight:700; color:#334155; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
        Payment Settlement Details
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px;">
        <div>
          <div style="font-size:10px; color:#94a3b8;">Transaction / Reference</div>
          <div style="font-weight:600; color:#334155; margin-top:2px; font-family:monospace;">${offlineRef !== '—' ? offlineRef : invoiceNum}</div>
        </div>
        <div>
          <div style="font-size:10px; color:#94a3b8;">Payment Date</div>
          <div style="font-weight:600; color:#334155; margin-top:2px;">${paidAt}</div>
        </div>
        <div>
          <div style="font-size:10px; color:#94a3b8;">Payment Method</div>
          <div style="font-weight:600; color:#334155; margin-top:2px;">${paymentMethod}</div>
        </div>
        <div>
          <div style="font-size:10px; color:#94a3b8;">Settled To</div>
          <div style="font-weight:600; color:#334155; margin-top:2px;">${communityName}</div>
        </div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
  <title>Invoice - ${invoiceNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; padding: 20px; }
    .container { max-width: 100%; margin: 0 auto; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #0f172a; }
    .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .org { text-align: right; font-size: 14px; font-weight: 700; color: #1e293b; }
    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px; }
    .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
    .value { font-weight: 700; color: #1e293b; font-size: 14px; }
    .status-badge { display: inline-block; margin-top: 8px; padding: 3px 10px; background: ${statusBg}; color: ${statusColor}; font-weight: 700; font-size: 10px; border-radius: 50px; border: 1px solid ${statusBorder}; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    .th { background: #f8fafc; padding: 8px 10px; font-weight: 600; color: #64748b; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-align: left; }
    .td { padding: 8px 10px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
    .td-num { text-align: right; }
    .total-row { font-weight: 800; background: #f1f5f9; font-size: 14px; }
    .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="title">Invoice / Receipt</div>
        <div class="sub">Nahom Mobile Statement</div>
      </div>
      <div class="org">
        ${communityName}
        ${communityAddress ? `<div class="sub">${communityAddress}</div>` : ''}
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="label">Billed To</div>
        <div class="value">${residentName}</div>
        <div>Unit: ${unitNumber}${unitType ? ' (' + unitType + ')' : ''}</div>
      </div>
      <div style="text-align: right;">
        <div class="label">Invoice Details</div>
        <div>Invoice #: <strong>${invoiceNum}</strong></div>
        <div>Period: ${billingPeriod}</div>
        <div>Date: ${invoiceDate}</div>
        <div class="status-badge">STATUS: ${status}</div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th class="th">Description</th>
          <th class="th td-num">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="td">${assessmentName} (${billingPeriod})</td>
          <td class="td td-num">₹${currentCharge.toLocaleString('en-IN')}</td>
        </tr>
        ${previousOutstanding > 0 ? `
        <tr>
          <td class="td">Previous Arrears</td>
          <td class="td td-num">₹${previousOutstanding.toLocaleString('en-IN')}</td>
        </tr>` : ''}
        ${lateFee > 0 ? `
        <tr>
          <td class="td">Late Fee / Penalty</td>
          <td class="td td-num">₹${lateFee.toLocaleString('en-IN')}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td class="td">Total Billed:</td>
          <td class="td td-num">₹${totalDue.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td class="td" style="color: #065f46; font-weight: 600;">Amount Paid:</td>
          <td class="td td-num" style="color: #065f46; font-weight: 600;">-₹${paidAmount.toLocaleString('en-IN')}</td>
        </tr>
        <tr class="total-row" style="background: #0f172a; color: #fff;">
          <td class="td" style="color: #fff;">Balance Due:</td>
          <td class="td td-num" style="color: #fff;">₹${outstanding.toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>

    ${settlementHTML}

    <div class="footer">
      <p>Computer-generated mobile receipt. Managed securely via Nahom.</p>
    </div>
  </div>
</body>
</html>`;
}
