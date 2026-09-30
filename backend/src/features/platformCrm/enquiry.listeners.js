import enquiryEvents from './enquiry.events.js';
import IntegrationHub from '../integrationHub/integrationHub.model.js';
import { decrypt } from '../integrationHub/utils/crypto.util.js';
import logger from '../../utils/logger.utils.js';
import nodemailer from 'nodemailer';
import User from '../user/user.model.js';
import { NotificationService } from '../notification/notification.service.js';
import crmInquiryService from '../crmInquiry/crmInquiry.service.js';

const notificationService = new NotificationService();

enquiryEvents.on('enquiry_created', async (enquiry) => {
  const identifier = enquiry.email;
  const username = enquiry.username || 'User';
  const orgName = enquiry.organizationName || 'your organization';

  const subject = 'Your ManageMyGate Enquiry has been received';
  const html = `
    <h3>Hello ${username},</h3>
    <p>Thank you for registering your organization "<strong>${orgName}</strong>".</p>
    <p>Your details have been successfully submitted and are currently pending review by our team.</p>
    <p>We will notify you once your account is fully activated.</p>
    <br/>
    <p>Best regards,</p>
    <p>The ManageMyGate Team</p>
  `;

  try {
    // Sync to CRM Inquiry so it shows up in the Enquiries Dashboard
    await crmInquiryService.createInquiry({
      customerName: username,
      organizationName: orgName,
      unitCount: enquiry.totalUnits || 1,
      contactEmail: identifier,
      contactPhone: enquiry.phone || null,
      selectedFeatures: enquiry.selectedFeatures || [],
      originSource: 'WEB_FORM',
    });
    logger.info(`Successfully synced new enquiry from ${orgName} to CrmInquiry`);
  } catch (crmError) {
    logger.error('Failed to sync new enquiry to CrmInquiry:', crmError);
  }

  try {
    // Notify Super Admin via in-app notification
    const superAdmin = await User.findOne({ username: 'superadmin' });
    if (superAdmin) {
      await notificationService.createNotification({
        recipientId: superAdmin._id,
        title: 'New Enquiry Received',
        body: `A new organization "${orgName}" has submitted an enquiry and is pending review.`,
        type: 'INFO',
        actionUrl: '/super-admin/crm',
      });
      logger.info(`In-app notification sent to Super Admin for new enquiry from ${orgName}`);
    }
  } catch (notifError) {
    logger.error('Failed to send in-app notification to Super Admin:', notifError);
  }

  try {
    // 1. Prioritize Gmail SMTP if configured
    const smtpIntegration = await IntegrationHub.findOne({ provider: 'smtp', status: 'connected' });
    
    if (smtpIntegration) {
      const getCred = (key) => {
        const cred = smtpIntegration.credentials.find((c) => c.key === key);
        return cred ? decrypt(cred.encryptedValue, cred.iv, cred.authTag) : null;
      };

      const host = getCred('host');
      const port = getCred('port');
      const authUsername = getCred('authUsername');
      const authPassword = getCred('authPassword');

      if (host && port && authUsername && authPassword) {
        const transporter = nodemailer.createTransport({
          host,
          port: parseInt(port, 10),
          secure: parseInt(port, 10) === 465,
          auth: {
            user: authUsername,
            pass: authPassword,
          },
        });

        await transporter.sendMail({
          from: `"${smtpIntegration.accountLabel || 'ManageMyGate'}" <${authUsername}>`,
          to: identifier,
          subject: subject,
          html: html,
        });

        logger.info(`Enquiry creation email sent to ${identifier} via SMTP`);
        return;
      }
    }

    // 2. Fallback to Resend API
    const resendIntegration = await IntegrationHub.findOne({ provider: 'resend', status: 'connected' });
    
    if (resendIntegration) {
      const apiKeyCred = resendIntegration.credentials.find((c) => c.key === 'apiKey');
      if (apiKeyCred) {
        const apiKey = decrypt(apiKeyCred.encryptedValue, apiKeyCred.iv, apiKeyCred.authTag);
        
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: 'ManageMyGate <onboarding@resend.dev>',
            to: [identifier],
            subject: subject,
            html: html,
          }),
        });

        if (response.ok) {
          logger.info(`Enquiry creation email sent to ${identifier} via Resend`);
          return;
        } else {
          const errData = await response.json();
          logger.error(`Resend email failed: ${errData.message}`);
        }
      }
    }

    logger.warn(`No active email provider (Resend/SMTP) found. Enquiry creation email to ${identifier} was not sent via network.`);
    
    // Simulate email in console for local development
    console.log(`\n======================================================`);
    console.log(`📧 SIMULATED EMAIL to [${identifier}]:`);
    console.log(`Subject: ${subject}`);
    console.log(`Hello ${username},`);
    console.log(`Thank you for registering your organization "${orgName}".`);
    console.log(`Your form has been successfully submitted and is currently pending review by our team.`);
    console.log(`We will notify you once your account is fully activated.`);
    console.log(`======================================================\n`);

  } catch (error) {
    logger.error(`Failed to send Enquiry creation email to ${identifier}:`, error);
  }
});


