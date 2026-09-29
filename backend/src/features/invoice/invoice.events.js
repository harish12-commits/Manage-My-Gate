import { EventEmitter } from 'events';
import twilio from 'twilio';
import logger from '../../utils/logger.utils.js';
import { normalizePhone } from '../../utils/phone.utils.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enterprise Event Payload Standard
 * Every emitted event MUST follow this structure:
 * {
 *   eventName: String,
 *   version: Number,
 *   timestamp: Date,
 *   correlationId: String,
 *   payload: { orgId, ...data }
 * }
 */
export const createVersionedPayload = (eventName, correlationId, payload) => ({
  eventName,
  version: 1,
  timestamp: new Date(),
  correlationId: correlationId || uuidv4(),
  payload
});

export const INVOICE_GENERATED = 'INVOICE_GENERATED';
export const INVOICE_STATUS_UPDATED = 'INVOICE_STATUS_UPDATED';
export const PAYMENT_LINK_CREATED = 'PAYMENT_LINK_CREATED';
export const PAYMENT_LINK_REGENERATED = 'PAYMENT_LINK_REGENERATED';
export const WHATSAPP_SENT = 'WHATSAPP_SENT';
export const INVOICE_PARTIALLY_PAID = 'INVOICE_PARTIALLY_PAID';
export const INVOICE_PAID = 'INVOICE_PAID';
export const INVOICE_OVERDUE = 'INVOICE_OVERDUE';
export const CARRY_FORWARD_CREATED = 'CARRY_FORWARD_CREATED';
export const SEND_WHATSAPP_LINK = 'SEND_WHATSAPP_LINK';
export const OFFLINE_PAYMENT_SUBMITTED = 'OFFLINE_PAYMENT_SUBMITTED';
export const BANK_TRANSFER_SUBMITTED = 'BANK_TRANSFER_SUBMITTED';
export const BANK_TRANSFER_APPROVED = 'BANK_TRANSFER_APPROVED';
export const BANK_TRANSFER_REJECTED = 'BANK_TRANSFER_REJECTED';
export const CASH_PAYMENT_RECORDED = 'CASH_PAYMENT_RECORDED';

export const invoiceEventEmitter = new EventEmitter();

// Load socket listeners asynchronously
import { setupInvoiceSocketListeners } from './invoice.socket.js';
setupInvoiceSocketListeners().catch((err) => {
  console.error('Failed to initialize invoice socket listeners:', err);
});

// Twilio WhatsApp Integration
invoiceEventEmitter.on(SEND_WHATSAPP_LINK, async (payload) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      logger.warn('Twilio credentials not configured, skipping WhatsApp notification');
      return;
    }

    const client = twilio(accountSid, authToken);

    if (payload.targetPhone && payload.paymentLink) {
      const formattedPhone = normalizePhone(payload.targetPhone);
      if (!formattedPhone) {
        logger.warn('Skipping WhatsApp invoice link: phone number is not valid', { invoiceId: payload.invoiceId });
        return;
      }
      const amountText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: payload.currency || 'INR' })
        .format(Number(payload.amount || 0));

      await client.messages.create({
        body: `Hello ${payload.userName},\nYour invoice for ${amountText} is ready. Pay securely here: ${payload.paymentLink}\nOr open the app to pay with your wallet.`,
        from: twilioWhatsAppNumber,
        to: `whatsapp:${formattedPhone}`
      });
      logger.info('WhatsApp invoice notification sent', { invoiceId: payload.invoiceId });
    }
  } catch (error) {
    logger.error('Failed to send WhatsApp invoice notification', { error: error.message });
  }
});

export default invoiceEventEmitter;
