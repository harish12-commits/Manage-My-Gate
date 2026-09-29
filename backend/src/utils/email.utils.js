import nodemailer from 'nodemailer';
import logger from './logger.utils.js';

export const getSmtpTransporter = async (orgId = null) => {
  try {
    const IntegrationHub = (await import('../features/integrationHub/integrationHub.model.js')).default;
    const { decrypt } = await import('../features/integrationHub/utils/crypto.util.js');

    let smtpIntegration = null;
    if (orgId) {
      smtpIntegration = await IntegrationHub.findOne({ $or: [{ orgId }, { organizationId: orgId }], provider: 'smtp' }).exec();
    }
    // Fallback is the PLATFORM's SMTP only — never another community's mailbox (tenant isolation).
    if (!smtpIntegration) {
      const Organization = (await import('../features/organization/organization.model.js')).default;
      const platformOrgs = await Organization.find({ isPlatform: true }).select('_id').lean();
      if (platformOrgs.length) {
        const platformIds = platformOrgs.map((o) => o._id);
        smtpIntegration = await IntegrationHub.findOne({
          $or: [{ orgId: { $in: platformIds } }, { organizationId: { $in: platformIds } }],
          provider: 'smtp',
        })
          .sort({ status: 1 })
          .exec();
      }
    }

    let host = process.env.SYSTEM_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
    let port = parseInt(process.env.SYSTEM_SMTP_PORT || process.env.SMTP_PORT || '587', 10);
    let authUsername = process.env.SYSTEM_SMTP_USER || process.env.SMTP_USER || process.env.GMAIL_USER;
    let authPassword = process.env.SYSTEM_SMTP_PASS || process.env.SMTP_PASS || process.env.GMAIL_PASS;

    if (smtpIntegration && smtpIntegration.credentials && smtpIntegration.credentials.length > 0) {
      const getCred = (key) => {
        const cred = smtpIntegration.credentials.find((c) => c.key === key);
        return cred ? decrypt(cred.encryptedValue, cred.iv) : null;
      };
      host = getCred('host') || host;
      port = parseInt(getCred('port') || port, 10);
      authUsername = getCred('authUsername') || authUsername;
      authPassword = getCred('authPassword') || authPassword;
    }

    if (!host || !authUsername || !authPassword) {
      logger.warn('[getSmtpTransporter] SMTP credentials missing.');
      return null;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: authUsername, pass: authPassword },
    });

    return {
      transporter,
      from: `"${smtpIntegration?.accountLabel || 'Nahom'}" <${authUsername}>`,
      authUsername,
    };
  } catch (err) {
    logger.error('[getSmtpTransporter] Error creating transporter:', err);
    return null;
  }
};

/**
 * @param {object} [options]
 * @param {string} [options.fromName] - Display name override (e.g. the community name); the sending address is kept.
 */
export const sendEmail = async (orgId, to, subject, htmlBody, options = {}) => {
  try {
    const smtpObj = await getSmtpTransporter(orgId);
    if (!smtpObj) {
      logger.warn(`SMTP integration not configured or credentials missing. Email not sent to ${to}`);
      return false;
    }

    const { transporter, authUsername } = smtpObj;
    const safeName = options.fromName ? String(options.fromName).replace(/["<>\r\n]/g, '').trim() : '';
    const from = safeName ? `"${safeName}" <${authUsername}>` : smtpObj.from;

    const mailOptions = {
      from,
      to,
      subject,
      html: htmlBody,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email successfully sent to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Error sending email to ${to}:`, error);
    return false;
  }
};
