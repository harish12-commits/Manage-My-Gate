import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import logger, { loggerStorage } from '../../utils/logger.utils.js';
import Invoice from './invoice.model.js';
import { enqueueInvoiceEmail } from './invoice.email.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const REMINDER_DAYS_BEFORE_DUE = 3;
// Only invoices that became overdue recently: the first run must not email years of old dues.
export const OVERDUE_LOOKBACK_DAYS = 7;
const BATCH_LIMIT = 1000;

/**
 * Finds invoices needing a due-soon reminder or an overdue notice and queues one email each.
 * Idempotent: sendInvoiceEmail claims emailLog.<kind>SentAt, so reruns never double-send.
 */
export async function runInvoiceReminders(now = new Date()) {
  const dueSoon = await Invoice.find({
    status: { $in: ['UNPAID', 'PARTIALLY_PAID'] },
    dueDate: { $gt: now, $lte: new Date(now.getTime() + REMINDER_DAYS_BEFORE_DUE * DAY_MS) },
    'emailLog.reminderSentAt': null,
  })
    .select('_id')
    .limit(BATCH_LIMIT)
    .lean();

  const overdue = await Invoice.find({
    status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    dueDate: { $lt: now, $gte: new Date(now.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS) },
    'emailLog.overdueSentAt': null,
  })
    .select('_id')
    .limit(BATCH_LIMIT)
    .lean();

  dueSoon.forEach((inv) => enqueueInvoiceEmail('reminder', inv._id));
  overdue.forEach((inv) => enqueueInvoiceEmail('overdue', inv._id));
  logger.info('Invoice reminder run queued emails', { reminders: dueSoon.length, overdue: overdue.length });
  return { reminders: dueSoon.length, overdue: overdue.length };
}

class InvoiceReminderCron {
  init() {
    // 03:30 UTC = 09:00 IST — morning delivery for the primary market.
    cron.schedule('30 3 * * *', async () => {
      await loggerStorage.run(`cron-invoice-reminders-${uuidv4()}`, async () => {
        try {
          await runInvoiceReminders();
        } catch (error) {
          logger.error('Invoice reminder cron failed', { error: error.message });
        }
      });
    });
    logger.info('Invoice reminder email cron scheduled (daily 03:30 UTC).');
  }
}

export default new InvoiceReminderCron();
