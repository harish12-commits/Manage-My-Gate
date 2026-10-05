import OutboxEvent from '../features/outbox/outboxEvent.model.js';
import outboxService from '../features/outbox/outbox.service.js';
import integrationHubService from '../features/integrationHub/integrationHub.service.js';
import messageTemplateService from '../features/messageTemplate/messageTemplate.service.js';
import logger from '../utils/logger.utils.js';
import nodemailer from 'nodemailer';
import { generateInviteLink } from '../features/user/utils/invite.utils.js';
import { sendEmail } from '../utils/email.utils.js';

const DEFAULT_INVITE_BODY = `
<div style="font-family: sans-serif; padding: 20px; color: #333;">
  <h2>Workspace Invitation</h2>
  <p>You have been invited to join our secure workspace.</p>
  <p>Please click the button below to complete your profile registration and activate your account:</p>
  <p style="margin: 30px 0;">
    <a href="{{invite_link}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
      Accept Invitation
    </a>
  </p>
  <p style="color: #666; font-size: 0.85rem; margin-top: 40px;">
    If the button above does not work, copy and paste this link in your browser:<br/>
    <a href="{{invite_link}}">{{invite_link}}</a>
  </p>
</div>
`;

const DEFAULT_INVOICE_BODY = `
<div style="font-family: sans-serif; padding: 20px; color: #333;">
  <h2>Invoice Generated</h2>
  <p>Hello {{organization_name}},</p>
  <p>Your invoice for total amount <strong>{{invoice_amount}}</strong> has been generated successfully.</p>
  <p style="margin: 30px 0;">
    <a href="{{invoice_link}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
      View / Download Invoice
    </a>
  </p>
</div>
`;

const DEFAULT_PROVISIONING_BODY = `
<div style="font-family: sans-serif; padding: 20px; color: #333;">
  <h2>Provisioning Completed</h2>
  <p>Hello {{organization_name}},</p>
  <p>Your platform workspace environment is fully provisioned and ready for access.</p>
  <p style="margin: 30px 0;">
    <a href="{{workspace_url}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
      Access Workspace
    </a>
  </p>
</div>
`;

/**
 * Handle USER_INVITED event type
 */
async function handleUserInvited(payload) {
  // USER_INVITED emails are dispatched immediately with rich branded templates in user.listeners.js upon creation.
  // Skipping duplicate dispatch in outbox worker to ensure users receive only one email matching their platform (APP or WEB).
  logger.info(`[Outbox Worker] USER_INVITED event already handled by user domain listener for ${payload?.email}. Skipping duplicate email dispatch.`);
}

/**
 * Handle INVOICE_GENERATED event type
 */
async function handleInvoiceGenerated(payload) {
  const { orgId, customerEmail, invoiceAmount, invoiceLink, organizationName } = payload;

  const template = await messageTemplateService.getTemplateByPurpose(orgId, 'email', 'invoice_generated');

  const subject = template?.subject || `Invoice Generated for ${organizationName || 'Your Community'}`;
  const bodyTemplate = template?.body || DEFAULT_INVOICE_BODY;

  const compiledSubject = subject
    .replace(/{{organization_name}}/g, organizationName || '')
    .replace(/{{invoice_amount}}/g, String(invoiceAmount || ''))
    .replace(/{{invoice_link}}/g, invoiceLink || '');

  const compiledBody = bodyTemplate
    .replace(/{{organization_name}}/g, organizationName || '')
    .replace(/{{invoice_amount}}/g, String(invoiceAmount || ''))
    .replace(/{{invoice_link}}/g, invoiceLink || '');

  const sent = await sendEmail(orgId, customerEmail, compiledSubject, compiledBody);
  if (!sent) {
    const smtpConnection = await integrationHubService.findSmtpConnection(orgId);
    if (!smtpConnection) {
      logger.warn(`[Outbox Worker] SMTP not configured for org ${orgId}. Invoice email for ${customerEmail} logged.`);
      return;
    }
    throw new Error(`Failed to dispatch INVOICE_GENERATED email to ${customerEmail}`);
  }
}

/**
 * Handle PROVISIONING_COMPLETED_EMAIL event type
 */
async function handleProvisioningCompletedEmail(payload) {
  const { orgId, customerEmail, workspaceUrl, organizationName } = payload;

  const template = await messageTemplateService.getTemplateByPurpose(orgId, 'email', 'provisioning_completed');

  const subject = template?.subject || `Provisioning Completed for ${organizationName || 'Your Workspace'}`;
  const bodyTemplate = template?.body || DEFAULT_PROVISIONING_BODY;

  const compiledSubject = subject
    .replace(/{{organization_name}}/g, organizationName || '')
    .replace(/{{workspace_url}}/g, workspaceUrl || '');

  const compiledBody = bodyTemplate
    .replace(/{{organization_name}}/g, organizationName || '')
    .replace(/{{workspace_url}}/g, workspaceUrl || '');

  const sent = await sendEmail(orgId, customerEmail, compiledSubject, compiledBody);
  if (!sent) {
    const smtpConnection = await integrationHubService.findSmtpConnection(orgId);
    if (!smtpConnection) {
      logger.warn(`[Outbox Worker] SMTP not configured for org ${orgId}. Provisioning email for ${customerEmail} logged.`);
      return;
    }
    throw new Error(`Failed to dispatch PROVISIONING_COMPLETED_EMAIL to ${customerEmail}`);
  }
}

/**
 * Process a single outbox event based on its type
 */
async function processEvent(event) {
  if (event.eventType === 'USER_INVITED') {
    await handleUserInvited(event.payload);
  } else if (event.eventType === 'INVOICE_GENERATED') {
    await handleInvoiceGenerated(event.payload);
  } else if (event.eventType === 'PROVISIONING_COMPLETED_EMAIL') {
    await handleProvisioningCompletedEmail(event.payload);
  } else if (
    event.eventType === 'NOTICE_PUBLISHED' ||
    event.eventType === 'NOTICE_ACKNOWLEDGEMENT_REMINDER' ||
    event.eventType === 'POLL_ACTIVATED' ||
    event.eventType === 'POLL_CLOSED' ||
    event.eventType === 'POLL_FINALIZED' ||
    event.eventType === 'POLL_CLOSING_SOON'
  ) {
    await outboxService.processEvent(event);
  } else {
    throw new Error(`Unknown event type: ${event.eventType}`);
  }
}

/**
 * Polls the database for PENDING outbox events using atomic locking (findOneAndUpdate)
 */
export async function processOutboxEvents() {
  const batchLimit = 50;
  let processedCount = 0;

  while (processedCount < batchLimit) {
    // Atomically find one PENDING event and mark it as PROCESSING
    const event = await OutboxEvent.findOneAndUpdate(
      { status: 'PENDING' },
      { $set: { status: 'PROCESSING' } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    );

    // If no more pending events found, terminate batch run
    if (!event) {
      break;
    }

    processedCount++;
    logger.info(`[Outbox Worker] Locked event ${event._id} (${event.eventType}). Processing...`);

    try {
      await processEvent(event);
      
      // Update event status to COMPLETED on success
      event.status = 'COMPLETED';
      event.error = null;
      await event.save();
      logger.info(`[Outbox Worker] Event ${event._id} processed successfully.`);
    } catch (err) {
      logger.error(`[Outbox Worker] Failed to process event ${event._id}: ${err.message}`);
      
      event.retries += 1;
      event.error = err.message;
      
      // Retry logic: if retries < 3, set back to PENDING, otherwise mark as FAILED
      if (event.retries < 3) {
        event.status = 'PENDING';
      } else {
        event.status = 'FAILED';
      }
      await event.save();
    }
  }
}

/**
 * Initialize worker polling interval
 */
export function init() {
  logger.info('⚙️ Outbox Worker initialized.');
  // Poll every 30 seconds
  setInterval(async () => {
    try {
      await processOutboxEvents();
    } catch (err) {
      logger.error(`[Outbox Worker] Polling error: ${err.message}`);
    }
  }, 30000);
}

export default {
  init,
  processOutboxEvents,
};
