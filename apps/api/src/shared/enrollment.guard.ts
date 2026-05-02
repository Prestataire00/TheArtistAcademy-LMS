import { prisma } from '../config/database';
import { NotFoundError, BadRequestError, UALockedError } from './errors';
import { isUALockedForEnrollment } from './pathway';

/**
 * Vérifie qu'un apprenant a une inscription active pour la formation contenant cette UA.
 * Réutilisé par les modules videos, quizzes et resources.
 *
 * Par défaut, applique le verrouillage du parcours linéaire : si l'UA est
 * verrouillée (module précédent non terminé OU UA précédente du même module
 * non terminée), lève une UALockedError 403. Passer { enforceUnlock: false }
 * pour désactiver — utile pour les routes purement métadonnées qui doivent
 * surfacer l'état verrouillé au lieu de le bloquer.
 */
export async function verifyLearnerAccess(
  userId: string,
  uaId: string,
  options: { enforceUnlock?: boolean } = {},
) {
  const { enforceUnlock = true } = options;

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

  if (enforceUnlock) {
    const locked = await isUALockedForEnrollment(
      uaId,
      enrollment.id,
      ua.module.formationId,
      ua.module.formation.pathwayMode,
    );
    if (locked) throw new UALockedError();
  }

  return { ua, enrollment, formation: ua.module.formation };
}
