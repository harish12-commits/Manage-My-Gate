import issueReportConfigRepository from './issueReportConfig.repository.js';
import HttpError from '../../utils/httpError.utils.js';

// Exactly one plain address: no whitespace, list separators, display names or header-injection characters.
export const SINGLE_EMAIL_REGEX = /^[^\s@,;<>"'()\\]+@[^\s@,;<>"'()\\]+\.[^\s@,;<>"'()\\]+$/;

export class IssueReportConfigService {
  /**
   * Retrieve the current platform admin issue report email configuration.
   *
   * @returns {Promise<{ email: string, updatedAt: Date|null }>}
   */
  async getConfig() {
    const configDoc = await issueReportConfigRepository.getConfig();
    return {
      email: configDoc?.platformAdminEmail || '',
      updatedAt: configDoc?.updatedAt || null,
    };
  }

  /**
   * Helper method for internal features to retrieve the active email string.
   *
   * @returns {Promise<string>} Configured email string or empty string if unconfigured.
   */
  async getPlatformReportEmail() {
    const configDoc = await issueReportConfigRepository.getConfig();
    return (configDoc?.platformAdminEmail || '').trim();
  }

  /**
   * Update the platform admin issue report email configuration.
   *
   * @param {string} email - New email address
   * @param {string} userId - Authenticated Platform Admin User ID
   * @returns {Promise<{ email: string, updatedAt: Date }>}
   */
  async updateConfig(email, userId) {
    const rawEmail = (email || '').trim().toLowerCase();

    // Sanitize and validate email address syntax if provided
    if (rawEmail) {
      if (rawEmail.length > 254 || !SINGLE_EMAIL_REGEX.test(rawEmail)) {
        throw new HttpError(400, 'Invalid email address format.');
      }
    }

    const updatedDoc = await issueReportConfigRepository.updateConfig(rawEmail, userId);
    return {
      email: updatedDoc.platformAdminEmail || '',
      updatedAt: updatedDoc.updatedAt,
    };
  }
  /**
   * Send a test email to verify SMTP configuration
   * @param {string} overrideEmail - Optional email to send test to (instead of saved config)
   */
  async sendTestEmail(overrideEmail) {
    const targetEmail = String(overrideEmail || await this.getPlatformReportEmail()).trim().toLowerCase();
    if (!targetEmail) {
      throw new HttpError(400, 'No email configured to receive the test.');
    }
    if (targetEmail.length > 254 || !SINGLE_EMAIL_REGEX.test(targetEmail)) {
      throw new HttpError(400, 'Invalid email address format.');
    }
    
    const { sendEmail } = await import('../../utils/email.utils.js');
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #333;">SMTP Configuration Test Successful</h2>
        <p style="color: #555; font-size: 16px;">Hello Platform Admin,</p>
        <p style="color: #555; font-size: 16px;">This is a test email to confirm that your SMTP integration is correctly configured and working.</p>
        <p style="color: #555; font-size: 16px;">You will now successfully receive real-time notifications when a user submits an Issue Report (App Complaint) from the mobile app.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #777; font-size: 14px;">Best regards,</p>
        <p style="color: #333; font-weight: bold; font-size: 14px;">Nahom System</p>
      </div>
    `;

    const success = await sendEmail(null, targetEmail, 'Nahom: SMTP Configuration Test', htmlBody);
    if (!success) {
      throw new HttpError(500, 'Failed to send test email. Please check your SMTP settings in Integration Hub.');
    }
    return true;
  }
}

export const issueReportConfigService = new IssueReportConfigService();
export default issueReportConfigService;
