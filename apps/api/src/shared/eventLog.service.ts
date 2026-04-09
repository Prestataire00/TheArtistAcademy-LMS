import { EventCategory, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from './logger';

interface LogEventParams {
  category: EventCategory;
  action: string;
  userId?: string;
  enrollmentId?: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service centralisé d'écriture des logs (append-only).
 * Ne jamais modifier ou supprimer les enregistrements EventLog.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await prisma.eventLog.create({ data: params as Prisma.EventLogCreateInput });
  } catch (err) {
    // Les logs ne doivent jamais faire planter l'application
    logger.error('Failed to write EventLog', { error: err, params });
  }
}
