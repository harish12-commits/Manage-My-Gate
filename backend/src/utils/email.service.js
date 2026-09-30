import logger from './logger.utils.js';
import { getSmtpTransporter } from './email.utils.js';

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

class EmailService {
  async sendWelcomeEmail({ to, organizationName, loginUrl }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Nahom, ${organizationName}!</h2>
        <p style="color: #555; font-size: 16px;">Your workspace has been successfully provisioned and is ready for use.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="padding: 12px 24px; background-color: #3399cc; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Workspace</a>
        </p>
        <br/>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="color: #777; font-size: 14px;">Best regards,</p>
        <p style="color: #333; font-weight: bold; font-size: 14px;">Nahom Team</p>
      </div>
    `;

    try {
      const smtpObj = await getSmtpTransporter();
      if (!smtpObj) {
        logger.warn(`Failed to send Welcome email to ${to}: SMTP credentials unavailable`);
        return;
      }
      const { transporter, from } = smtpObj;
      await transporter.sendMail({
        from,
        to,
        subject: 'Welcome to Nahom',
        html,
      });
      logger.info(`Welcome email sent to ${to}`);
    } catch (error) {
      logger.error(`Failed to send Welcome email to ${to}:`, error);
      throw error;
    }
  }

  async sendPaymentReceipt({ to, organizationName, invoiceId, invoicePath }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Receipt - ${invoiceId}</h2>
        <p style="color: #555; font-size: 16px;">Dear ${organizationName},</p>
        <p style="color: #555; font-size: 16px;">Thank you for your payment. Your subscription renewal was successful.</p>
        <p style="color: #555; font-size: 16px;">Please find attached your GST-compliant PDF invoice.</p>
        <br/>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="color: #777; font-size: 14px;">Best regards,</p>
        <p style="color: #333; font-weight: bold; font-size: 14px;">Nahom Team</p>
      </div>
    `;

    try {
      const smtpObj = await getSmtpTransporter();
      if (!smtpObj) {
        logger.warn(`Failed to send Payment Receipt to ${to}: SMTP credentials unavailable`);
        return;
      }
      const { transporter, from } = smtpObj;
      await transporter.sendMail({
        from,
        to,
        subject: `Payment Receipt: ${invoiceId}`,
        html,
        attachments: invoicePath ? [
          {
            filename: `Invoice_${invoiceId}.pdf`,
            path: invoicePath
          }
        ] : []
      });
      logger.info(`Payment receipt sent to ${to} for invoice ${invoiceId}`);
    } catch (error) {
      logger.error(`Failed to send Payment Receipt to ${to}:`, error);
      throw error;
    }
  }

  async sendExpiryWarning({ to, organizationName, daysRemaining, renewalUrl }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d9534f;">Subscription Expiring Soon!</h2>
        <p style="color: #555; font-size: 16px;">Dear ${organizationName},</p>
        <p style="color: #555; font-size: 16px;">Your Nahom subscription is expiring in <strong style="color: #d9534f;">${daysRemaining} days</strong>.</p>
        <p style="color: #555; font-size: 16px;">Please renew your subscription to avoid service interruption.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${renewalUrl}" style="padding: 12px 24px; background-color: #f0ad4e; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Renew Now</a>
        </p>
        <br/>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="color: #777; font-size: 14px;">Best regards,</p>
        <p style="color: #333; font-weight: bold; font-size: 14px;">Nahom Team</p>
      </div>
    `;

    try {
      const smtpObj = await getSmtpTransporter();
      if (!smtpObj) {
        logger.warn(`Failed to send Expiry Warning to ${to}: SMTP credentials unavailable`);
        return;
      }
      const { transporter, from } = smtpObj;
      await transporter.sendMail({
        from,
        to,
        subject: 'Action Required: Subscription Expiring',
        html,
      });
      logger.info(`Expiry warning sent to ${to}`);
    } catch (error) {
      logger.error(`Failed to send Expiry Warning to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send reported issue notification email to Platform Admin.
   *
   * @param {Object} params
   * @param {string} params.to - Platform Admin recipient email address
   * @param {Object} params.report - IssueReport Mongoose document or object
   * @param {Array} [params.attachments=[]] - Nodemailer attachment options array
   * @returns {Promise<boolean>} True if successfully sent, false otherwise
   */
  async sendReportedIssueEmail({ to, report, attachments = [] }) {
    if (!to || !report) return false;

    // Every value below is user-controlled (reporter, community and device text): escape before
    // interpolating into HTML so a report can never inject markup or links into the admin's inbox.
    const reportNumber = escapeHtml(report.reportNumber || 'N/A');
    const rawTitle = String(report.title || 'Untitled Issue');
    const title = escapeHtml(rawTitle);
    const description = escapeHtml(report.description || 'No description provided.');
    const reportType = escapeHtml(report.reportType || 'N/A');
    const feature = escapeHtml(report.feature || 'N/A');
    const reporterName = escapeHtml(report.reporter?.name || 'Anonymous');
    const reporterEmail = escapeHtml(report.reporter?.email || 'N/A');
    const reporterPhone = escapeHtml(report.reporter?.phone || '');
    const reporterRole = escapeHtml(report.reporter?.role || 'User');
    const orgName = escapeHtml(report.organisation?.name || 'Community');
    const status = escapeHtml(report.status || 'NEW');
    const source = escapeHtml(report.source || 'MOBILE_APP');
    const reportId = escapeHtml(report._id || 'N/A');

    const techContext = report.technicalContext || {};
    const platform = escapeHtml(techContext.platform || 'N/A');
    const appVersion = escapeHtml(techContext.appVersion || 'N/A');
    const deviceModel = escapeHtml(techContext.deviceModel || 'N/A');
    const osVersion = escapeHtml(techContext.osVersion || 'N/A');

    const reportedDate = report.createdAt
      ? new Date(report.createdAt).toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : new Date().toLocaleString();

    const attachmentNotice = attachments && attachments.length > 0
      ? `<p style="color: #2b6cb0; font-weight: bold; margin-top: 15px;">📎 ${attachments.length} image attachment(s) included with this report.</p>`
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #1a365d; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">📢 New Issue Report Submitted</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.85; font-size: 14px;">Report Number: <strong>${reportNumber}</strong></p>
        </div>
        <div style="padding: 24px; color: #2d3748; line-height: 1.6;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #4a5568;">Issue Title:</td>
              <td style="padding: 8px 0; font-size: 16px; font-weight: bold; color: #1a202c;">${title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Report ID:</td>
              <td style="padding: 8px 0;"><code>${reportNumber}</code> (ID: ${reportId})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Status:</td>
              <td style="padding: 8px 0;"><span style="background-color: #edf2f7; color: #2d3748; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">${status}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Category / Type:</td>
              <td style="padding: 8px 0;">${reportType} — ${feature}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Reported By:</td>
              <td style="padding: 8px 0;">${reporterName} (${reporterRole}) &lt;<a href="mailto:${reporterEmail}" style="color: #3182ce;">${reporterEmail}</a>&gt;</td>
            </tr>
            ${reporterPhone ? `<tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Phone:</td>
              <td style="padding: 8px 0;">${reporterPhone}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Community / Org:</td>
              <td style="padding: 8px 0;">${orgName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Date & Time:</td>
              <td style="padding: 8px 0;">${reportedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4a5568;">Source Platform:</td>
              <td style="padding: 8px 0;">${source} (${platform})</td>
            </tr>
          </table>

          <div style="background-color: #f7fafc; border-left: 4px solid #3182ce; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: #2b6cb0;">Issue Description:</h4>
            <p style="margin: 0; white-space: pre-wrap; color: #2d3748;">${description}</p>
          </div>

          ${
            platform !== 'N/A' || appVersion !== 'N/A' || deviceModel !== 'N/A'
              ? `
          <div style="background-color: #edf2f7; padding: 12px 15px; border-radius: 6px; font-size: 13px; color: #4a5568; margin-top: 15px;">
            <strong>Technical Context:</strong> Platform: ${platform} | App Version: ${appVersion} | Device: ${deviceModel} | OS: ${osVersion}
          </div>
          `
              : ''
          }

          ${attachmentNotice}
        </div>
        <div style="background-color: #f7fafc; border-top: 1px solid #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #a0aec0;">
          This is an automated system notification from Nahom Platform Admin Support.
        </div>
      </div>
    `;

    try {
      const orgId = report.organisation?._id || report.organisation || null;
      const smtpObj = await getSmtpTransporter(orgId);
      if (!smtpObj) {
        logger.warn(`[EmailService] Cannot send reported issue email to ${to}: SMTP transporter unavailable.`);
        return false;
      }

      const { transporter, from } = smtpObj;
      await transporter.sendMail({
        from,
        to,
        subject: `[Issue Report #${report.reportNumber || 'N/A'}] ${rawTitle}`.replace(/[\r\n]+/g, ' ').slice(0, 250),
        html,
        attachments: attachments || [],
      });

      logger.info(`[EmailService] Successfully sent reported issue email to ${to} for report ${reportNumber}`);
      return true;
    } catch (error) {
      logger.error(`[EmailService] Failed to send reported issue email to ${to}:`, error.message);
      return false;
    }
  }
}

export default new EmailService();
