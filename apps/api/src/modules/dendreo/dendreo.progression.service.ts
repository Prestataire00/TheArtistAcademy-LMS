import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { logEvent } from '../../shared/eventLog.service';
import { logger } from '../../shared/logger';

const DENDREO_PROGRESSION_URL = 'https://hooks.dendreo.com/lms-progression';
// Retry exponentiel : 1mn, 2mn, 5mn, 10mn, 30mn, 1h, 2h, 6h, 12h
const RETRY_DELAYS_MS = [
  60_000,
  120_000,
  300_000,
  600_000,
  1_800_000,
  3_600_000,
  7_200_000,
  21_600_000,
  43_200_000,
];

interface ProgressionPayload {
  event: 'enrolment.progress';
  timestamp: string;
  lms_name: string;
  tenant_id: string;
  data: {
    enrolment_id: string;
    progression: number;
    score: number | null;
    time_spent: number;
    started_at: string | null;
    completed_at: string | null;
    last_access_at: string | null;
  };
}

/**
 * Envoie la progression d'un enrollment à Dendreo.
 * Appelé après chaque mise à jour de progression.
 */
export async function sendProgressionToDendreo(enrollmentId: string): Promise<void> {
  const webhookSecret = env.DENDREO_SIGNATURE_KEY || env.DENDREO_WEBHOOK_SECRET;
  if (!webhookSecret || !env.DENDREO_TENANT_ID) {
    logger.debug('Dendreo progression webhook skipped: missing config');
    return;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      formationProgress: true,
      quizAttempts: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!enrollment || !enrollment.dendreoEnrolmentId) return;

  const fp = enrollment.formationProgress;

  const payload: ProgressionPayload = {
    event: 'enrolment.progress',
    timestamp: new Date().toISOString(),
    lms_name: env.DENDREO_LMS_NAME,
    tenant_id: env.DENDREO_TENANT_ID,
    data: {
      enrolment_id: enrollment.dendreoEnrolmentId,
      progression: fp?.progressPercent ?? 0,
      score: enrollment.quizAttempts[0]?.scorePercent ?? null,
      time_spent: fp?.timeSpentSeconds ?? 0,
      started_at: fp?.firstAccessedAt?.toISOString() ?? null,
      completed_at: fp?.completedAt?.toISOString() ?? null,
      last_access_at: fp?.lastActivityAt?.toISOString() ?? null,
    },
  };

  // Lancer l'envoi avec retry en arrière-plan (ne pas bloquer la requête)
  sendWithRetry(payload, enrollmentId, 0).catch((err) => {
    logger.error('Dendreo progression webhook failed after all retries', {
      enrollmentId,
      error: (err as Error).message,
    });
  });
}

async function sendWithRetry(
  payload: ProgressionPayload,
  enrollmentId: string,
  attempt: number,
): Promise<void> {
  const body = JSON.stringify(payload);
  const webhookSecret = env.DENDREO_SIGNATURE_KEY || env.DENDREO_WEBHOOK_SECRET;
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  try {
    const response = await fetch(DENDREO_PROGRESSION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Signature': signature,
      },
      body,
    });

    await logEvent({
      category: 'webhook',
      action: 'progression.sent',
      enrollmentId,
      entityType: 'enrollment',
      entityId: enrollmentId,
      payload: {
        attempt: attempt + 1,
        statusCode: response.status,
        success: response.ok,
        progression: payload.data.progression,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Mettre à jour webhookLastSyncedAt
    await prisma.formationProgress.updateMany({
      where: { enrollmentId },
      data: { webhookLastSyncedAt: new Date() },
    });

    logger.info('Dendreo progression webhook sent', {
      enrollmentId,
      progression: payload.data.progression,
    });
  } catch (err) {
    await logEvent({
      category: 'webhook',
      action: 'progression.failed',
      enrollmentId,
      entityType: 'enrollment',
      entityId: enrollmentId,
      payload: {
        attempt: attempt + 1,
        error: (err as Error).message,
      },
    });

    if (attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt];
      logger.warn(`Dendreo progression webhook retry in ${delay / 1000}s`, {
        enrollmentId,
        attempt: attempt + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWithRetry(payload, enrollmentId, attempt + 1);
    }

    throw err;
  }
}
