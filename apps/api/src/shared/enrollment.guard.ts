import { prisma } from '../config/database';
import { NotFoundError, BadRequestError } from './errors';

/**
 * Vérifie qu'un apprenant a une inscription active pour la formation contenant cette UA.
 * Réutilisé par les modules videos, quizzes et resources.
 */
export async function verifyLearnerAccess(userId: string, uaId: string) {
  const ua = await prisma.uA.findUnique({
    where: { id: uaId },
    include: { module: { include: { formation: true } } },
  });
  if (!ua) throw new NotFoundError('UA');

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      formationId: ua.module.formationId,
      status: 'active',
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });

  if (!enrollment) {
    throw new BadRequestError("Vous n'avez pas d'inscription active pour cette formation");
  }

  return { ua, enrollment, formation: ua.module.formation };
}
