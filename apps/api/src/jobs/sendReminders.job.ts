import cron from 'node-cron';
import { logger } from '../shared/logger';
import { sendDailyReminders } from '../modules/reminders/reminders.service';

/**
 * Job cron : envoi des relances email quotidiennes à 9h00.
 */
export function startReminderScheduler() {
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running daily reminder job...');
    try {
      const summary = await sendDailyReminders();
      logger.info('Reminder job completed', summary);
    } catch (err) {
      logger.error('Reminder job failed', { error: err });
    }
  });

  logger.info('Reminder scheduler started (daily at 09:00)');
}
