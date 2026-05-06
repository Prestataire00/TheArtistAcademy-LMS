import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { sendProgressionToDendreo } from './dendreo.progression.service';
import { fetchDendreoParticipant } from './dendreo.api.client';

/**
 * Convertit un identifiant externe Dendreo en string ou null.
 * Dendreo envoie ses ids en INT(11) (external_id, session_id, enrolment_id),
 * mais le schéma Prisma stocke en String? pour homogénéiser avec d'autres TMS.
 *
 * Comportement :
 *   - undefined / null  -> null
 *   - 0                 -> "0"   (PAS null — 0 est un id valide)
 *   - 12345             -> "12345"
 *   - "12345"           -> "12345"
 */
export function toExternalIdString(value: unknown): string | null {
  return value != null ? String(value) : null;
}

// ─── Users webhook ───────────────────────────────────────────────────────────

interface UserWebhookPayload {
  event: 'user.created';
  timestamp?: string;
  tenant_id?: string;
  data: {
    // Nouvelle spec : firstname/lastname séparés, password hashé, external_id
    firstname?: string;
    lastname?: string;
    password?: string;
    send_credentials?: boolean;
    tms_origin?: string;
    external_id?: string | number;
    // Ancien format compat (full_name + id)
    id?: string | number;
    full_name?: string;
    email: string;
  };
}

export async function handleUserWebhook(payload: UserWebhookPayload) {
  if (payload.event !== 'user.created') {
    throw new BadRequestError(`Événement non supporté: ${payload.event}`);
  }

  const d = payload.data;
  // Dendreo envoie external_id/id en INT(11) — caster en string pour Prisma.
  const externalId = toExternalIdString(d.external_id ?? d.id);
  const fullName = d.full_name ?? [d.firstname, d.lastname].filter(Boolean).join(' ').trim();
  const tmsOrigin = d.tms_origin ?? 'dendreo';

  if (!d.email || !fullName) {
    throw new BadRequestError('email et nom complet (firstname+lastname ou full_name) sont requis');
  }

  // Hash le password si fourni (nouvelle spec)
  const passwordHash = d.password ? await bcrypt.hash(d.password, 12) : undefined;

  // Pont d'identité Dendreo : on remplit aussi `dendreoUserId` (en plus du
  // générique `externalId`) parce que c'est cette colonne que la
  // résolution SSO interroge en fallback (cf. auth.service.findUserForSso)
  // et c'est la clé sur laquelle le futur fix du matching user.created
  // s'appuiera (cf. bug c — "matcher d'abord sur dendreo_user_id"). Tant
  // que les deux colonnes coexistent, on les garde synchronisées.
  const dendreoUserId = tmsOrigin === 'dendreo' ? externalId : null;

  const user = await prisma.user.upsert({
    where: { email: d.email },
    update: {
      fullName,
      externalId,
      ...(dendreoUserId ? { dendreoUserId } : {}),
      tmsOrigin,
      isActive: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: d.email,
      fullName,
      externalId,
      ...(dendreoUserId ? { dendreoUserId } : {}),
      tmsOrigin,
      roles: ['learner'],
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  await logEvent({
    category: 'webhook',
    action: 'user.created',
    userId: user.id,
    entityType: 'user',
    entityId: user.id,
    payload: { externalId, email: d.email },
  });

  logger.info('Dendreo webhook: user created/updated', { userId: user.id, email: d.email });

  return { user_id: user.id };
}

// ─── Sessions webhook ────────────────────────────────────────────────────────

interface SessionWebhookPayload {
  event: 'session.created' | 'session.updated' | 'session.deleted';
  timestamp?: string;
  tenant_id?: string;
  data: {
    training_id: string;
    session_id?: string | number;  // INT(11) côté Dendreo
    external_id?: string | number; // alias session_id si Dendreo l'envoie ainsi
    start_date?: string;
    end_date?: string;
    tms_origin?: string;
    name?: string;
  };
}

export async function handleSessionWebhook(payload: SessionWebhookPayload) {
  const { event, data } = payload;
  // Caster en string : Dendreo envoie session_id/external_id en INT(11)
  const externalId = toExternalIdString(data.session_id ?? data.external_id);

  if (event === 'session.deleted') {
    if (!externalId) throw new BadRequestError('session_id requis pour delete');
    const existing = await prisma.dendreoSession.findUnique({ where: { externalId } });
    if (!existing) throw new NotFoundError(`Session ${externalId}`);
    await prisma.dendreoSession.delete({ where: { externalId } });
    await logEvent({
      category: 'webhook',
      action: 'session.deleted',
      entityType: 'dendreo_session',
      entityId: existing.id,
      payload: { externalId },
    });
    return { session_id: existing.id };
  }

  if (event !== 'session.created' && event !== 'session.updated') {
    throw new BadRequestError(`Événement non supporté: ${event}`);
  }

  if (!data.training_id || !data.start_date || !data.end_date || !externalId) {
    throw new BadRequestError('training_id, session_id, start_date et end_date sont requis');
  }

  const formation = await prisma.formation.findUnique({ where: { id: data.training_id } });
  if (!formation) {
    throw new NotFoundError(`Training ${data.training_id}`);
  }

  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const tmsOrigin = data.tms_origin ?? 'dendreo';

  const session = await prisma.dendreoSession.upsert({
    where: { externalId },
    update: {
      formationId: data.training_id,
      name: data.name ?? null,
      startDate,
      endDate,
      tmsOrigin,
    },
    create: {
      formationId: data.training_id,
      externalId,
      name: data.name ?? null,
      startDate,
      endDate,
      tmsOrigin,
    },
  });

  await logEvent({
    category: 'webhook',
    action: event,
    entityType: 'dendreo_session',
    entityId: session.id,
    payload: { externalId, trainingId: data.training_id },
  });

  logger.info(`Dendreo webhook: ${event}`, { sessionId: session.id, externalId });

  return { session_id: session.id };
}

// ─── Enrolments webhook ──────────────────────────────────────────────────────

interface EnrolmentWebhookPayload {
  event: 'enrolment.created' | 'enrolment.updated' | 'enrolment.deleted';
  timestamp?: string;
  tenant_id?: string;
  data: {
    enrolment_id?: string | number;  // INT(11) côté Dendreo
    training_id: string;
    session_id?: string | number;    // INT(11) côté Dendreo
    user_id: string;
    start_date: string;
    end_date: string;
    send_notification?: boolean;
    tms_origin?: string;
    external_id?: string | number;   // INT(11) côté Dendreo
  };
}

export async function handleEnrolmentWebhook(payload: EnrolmentWebhookPayload) {
  const { event, data } = payload;
  // Caster en string : Dendreo envoie enrolment_id/external_id/session_id en INT(11)
  const dendreoEnrolmentId = toExternalIdString(data.enrolment_id ?? data.external_id);
  const dendreoSessionId = toExternalIdString(data.session_id);

  if (!data.user_id) {
    throw new BadRequestError('user_id est requis');
  }

  if (event === 'enrolment.deleted') {
    if (!dendreoEnrolmentId) throw new BadRequestError('enrolment_id requis pour delete');
    return handleEnrolmentDeleted(dendreoEnrolmentId);
  }

  if (event !== 'enrolment.created' && event !== 'enrolment.updated') {
    throw new BadRequestError(`Événement non supporté: ${event}`);
  }

  if (!data.training_id || !data.start_date || !data.end_date) {
    throw new BadRequestError('training_id, start_date et end_date sont requis');
  }

  const formation = await prisma.formation.findUnique({ where: { id: data.training_id } });
  if (!formation) {
    throw new NotFoundError(`Training ${data.training_id}`);
  }

  const user = await prisma.user.findUnique({ where: { id: data.user_id } });
  if (!user) {
    throw new NotFoundError(`User ${data.user_id}`);
  }

  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const now = new Date();
  const status = now < startDate ? 'future' : now > endDate ? 'closed' : 'active';
  const tmsOrigin = data.tms_origin ?? 'dendreo';

  let enrollment;
  let alreadyExisted = false;

  if (dendreoEnrolmentId) {
    const existing = await prisma.enrollment.findUnique({
      where: { dendreoEnrolmentId },
    });
    alreadyExisted = !!existing;

    enrollment = await prisma.enrollment.upsert({
      where: { dendreoEnrolmentId },
      update: {
        formationId: data.training_id,
        dendreoSessionId,
        startDate,
        endDate,
        status,
      },
      create: {
        userId: data.user_id,
        formationId: data.training_id,
        dendreoEnrolmentId,
        dendreoSessionId,
        tmsOrigin,
        startDate,
        endDate,
        status,
      },
    });
  } else {
    // Pas de dendreoEnrolmentId fourni : on crée sans contrainte unique côté Dendreo.
    // On évite le doublon en cherchant un enrollment existant pour ce couple (user, formation).
    const existing = await prisma.enrollment.findFirst({
      where: { userId: data.user_id, formationId: data.training_id },
    });
    alreadyExisted = !!existing;

    enrollment = existing
      ? await prisma.enrollment.update({
          where: { id: existing.id },
          data: { startDate, endDate, status, dendreoSessionId },
        })
      : await prisma.enrollment.create({
          data: {
            userId: data.user_id,
            formationId: data.training_id,
            dendreoSessionId,
            tmsOrigin,
            startDate,
            endDate,
            status,
          },
        });
  }

  await logEvent({
    category: 'webhook',
    action: event,
    userId: data.user_id,
    enrollmentId: enrollment.id,
    entityType: 'enrollment',
    entityId: enrollment.id,
    payload: { dendreoEnrolmentId, trainingId: data.training_id },
  });

  // Pull Extranet info (autologin URL) — fire-and-forget, ne bloque pas le webhook.
  // Conditions : enrolment.created + user a un externalId + URL pas encore stockée.
  if (
    event === 'enrolment.created' &&
    user.externalId &&
    !user.extranetAutologinUrl
  ) {
    void pullExtranetInfo(user.id, user.externalId);
  }

  // Spec : si l'enrolment existait déjà sur enrolment.created -> renvoyer la progression
  if (event === 'enrolment.created' && alreadyExisted) {
    sendProgressionToDendreo(enrollment.id).catch(() => {});
  }

  logger.info(`Dendreo webhook: ${event}`, { enrollmentId: enrollment.id });

  return { enrolment_id: enrollment.id };
}

async function handleEnrolmentDeleted(dendreoEnrolmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { dendreoEnrolmentId },
  });

  if (!enrollment) {
    throw new NotFoundError(`Enrollment ${dendreoEnrolmentId}`);
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: 'closed' },
  });

  await logEvent({
    category: 'webhook',
    action: 'enrolment.deleted',
    userId: enrollment.userId,
    enrollmentId: enrollment.id,
    entityType: 'enrollment',
    entityId: enrollment.id,
    payload: { dendreoEnrolmentId },
  });

  logger.info('Dendreo webhook: enrolment deleted (closed)', { enrollmentId: enrollment.id });

  return { enrolment_id: enrollment.id };
}

async function pullExtranetInfo(userId: string, externalId: string): Promise<void> {
  try {
    const participant = await fetchDendreoParticipant(externalId);
    if (!participant) return;

    const updates: { extranetAutologinUrl?: string; extranetCode?: string } = {};
    if (participant.extranet_autologin_url) {
      updates.extranetAutologinUrl = participant.extranet_autologin_url;
    }
    if (participant.extranet_code) {
      updates.extranetCode = participant.extranet_code;
    }

    if (Object.keys(updates).length === 0) {
      logger.warn('Dendreo API: extranet_autologin_url absent dans la réponse', {
        userId,
        externalId,
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    logger.info('Dendreo: extranet info stocké', { userId });
  } catch (err) {
    logger.error('Dendreo: échec pull extranet info', {
      userId,
      externalId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
