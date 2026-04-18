import { prisma } from '../../config/database';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { logger } from '../../shared/logger';

// ─── Users webhook ───────────────────────────────────────────────────────────

interface UserWebhookPayload {
  event: 'user.created';
  data: {
    id: string;         // id Participant Dendreo (external_id)
    email: string;
    full_name: string;
  };
}

export async function handleUserWebhook(payload: UserWebhookPayload) {
  if (payload.event !== 'user.created') {
    throw new BadRequestError(`Événement non supporté: ${payload.event}`);
  }

  const { id: externalId, email, full_name } = payload.data;

  if (!email || !full_name) {
    throw new BadRequestError('email et full_name sont requis');
  }

  // Créer ou retrouver l'apprenant par email
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: full_name,
      externalId,
      tmsOrigin: 'dendreo',
      isActive: true,
    },
    create: {
      email,
      fullName: full_name,
      externalId,
      tmsOrigin: 'dendreo',
      role: 'learner',
    },
  });

  await logEvent({
    category: 'webhook',
    action: 'user.created',
    userId: user.id,
    entityType: 'user',
    entityId: user.id,
    payload: { externalId, email },
  });

  logger.info('Dendreo webhook: user created/updated', { userId: user.id, email });

  return { user_id: user.id };
}

// ─── Enrolments webhook ──────────────────────────────────────────────────────

interface EnrolmentWebhookPayload {
  event: 'enrolment.created' | 'enrolment.updated' | 'enrolment.deleted';
  data: {
    enrolment_id: string;
    training_id: string;   // = formationId LMS
    session_id?: string;
    start_date: string;    // ISO date
    end_date: string;      // ISO date
    user_id: string;       // LMS user_id
  };
}

export async function handleEnrolmentWebhook(payload: EnrolmentWebhookPayload) {
  const { event, data } = payload;

  if (!data.enrolment_id || !data.user_id) {
    throw new BadRequestError('enrolment_id et user_id sont requis');
  }

  if (event === 'enrolment.deleted') {
    return handleEnrolmentDeleted(data.enrolment_id);
  }

  if (event !== 'enrolment.created' && event !== 'enrolment.updated') {
    throw new BadRequestError(`Événement non supporté: ${event}`);
  }

  if (!data.training_id || !data.start_date || !data.end_date) {
    throw new BadRequestError('training_id, start_date et end_date sont requis');
  }

  // Vérifier que la formation existe
  const formation = await prisma.formation.findUnique({ where: { id: data.training_id } });
  if (!formation) {
    throw new NotFoundError(`Formation ${data.training_id}`);
  }

  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({ where: { id: data.user_id } });
  if (!user) {
    throw new NotFoundError(`Utilisateur ${data.user_id}`);
  }

  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const now = new Date();
  const status = now < startDate ? 'future' : now > endDate ? 'closed' : 'active';

  const enrollment = await prisma.enrollment.upsert({
    where: { dendreoEnrolmentId: data.enrolment_id },
    update: {
      formationId: data.training_id,
      dendreoSessionId: data.session_id,
      startDate,
      endDate,
      status,
    },
    create: {
      userId: data.user_id,
      formationId: data.training_id,
      dendreoEnrolmentId: data.enrolment_id,
      dendreoSessionId: data.session_id,
      tmsOrigin: 'dendreo',
      startDate,
      endDate,
      status,
    },
  });

  await logEvent({
    category: 'webhook',
    action: event,
    userId: data.user_id,
    enrollmentId: enrollment.id,
    entityType: 'enrollment',
    entityId: enrollment.id,
    payload: { dendreoEnrolmentId: data.enrolment_id, trainingId: data.training_id },
  });

  logger.info(`Dendreo webhook: ${event}`, { enrollmentId: enrollment.id });

  return { enrolment_id: enrollment.id };
}

async function handleEnrolmentDeleted(dendreoEnrolmentId: string) {
  // Désactiver l'accès sans supprimer la progression
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
