import cron from 'node-cron';
import { logger } from '../shared/logger';
import { ensureDefaultTemplateAndRule, runRemindersForHour } from '../modules/reminders/reminders.service';

/**
 * Cron exécuté toutes les heures (minute 0). Sélectionne les règles actives
 * dont sendHour = heure courante et envoie les relances.
 */
export function startReminderScheduler() {
  ensureDefaultTemplateAndRule().catch((err) => logger.error('Failed to seed default reminder', { error: err }));

  cron.schedule('0 * * * *', async () => {
    const hour = new Date().getHours();
    logger.info('Running hourly reminder job', { hour });
    try {
      const summary = await runRemindersForHour(hour);
      logger.info('Reminder job completed', { hour, ...summary });
    } catch (err) {
      logger.error('Reminder job failed', { hour, error: err });
    }
  });

  logger.info('Reminder scheduler started (hourly)');
}
