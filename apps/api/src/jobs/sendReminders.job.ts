import cron from 'node-cron';
import { logger } from '../shared/logger';

/**
 * Job cron : envoi des relances email quotidiennes.
 * Lancé au démarrage du serveur.
 * Implémentation complète : Phase 3.
 */
export function startReminderScheduler() {
  // Tous les jours à 9h00
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running daily reminder job...');
    try {
      // TODO: Phase 3 — implémenter sendDailyReminders()
      logger.info('Reminder job completed');
    } catch (err) {
      logger.error('Reminder job failed', { error: err });
    }
  });

  logger.info('Reminder scheduler started (daily at 09:00)');
}
