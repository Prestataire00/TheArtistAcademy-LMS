import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError } from './errors';

/**
 * Vrai si le user est assigné comme formateur principal sur au moins
 * une formation (Formation.trainerId = user.id). Indépendant du rôle :
 * un admin peut être assigné, un trainer non assigné ne passera pas.
 */
export async function userIsAssignedTrainer(userId: string): Promise<boolean> {
  const count = await prisma.formation.count({
    where: { trainerId: userId },
  });
  return count > 0;
}

/**
 * Vérifie qu'une UA appartient à une formation dont le user est le
 * trainer. Lève NotFoundError si l'UA n'existe pas, ForbiddenError
 * si elle existe mais ne fait pas partie des formations du trainer.
 * Utilisé par les endpoints /formateur/contenus/uas/:uaId/* pour
 * empêcher un trainer assigné de modifier le contenu d'un autre.
 */
export async function requireUaOwnership(uaId: string, trainerId: string) {
  const ua = await prisma.uA.findUnique({
    where: { id: uaId },
    include: { module: { select: { formation: { select: { trainerId: true } } } } },
  });
  if (!ua) throw new NotFoundError('UA');
  if (ua.module.formation.trainerId !== trainerId) {
    throw new ForbiddenError("Cette UA appartient à une formation qui ne vous est pas assignée");
  }
  return ua;
}

/**
 * Middleware d'accès /formateur/* : 403 si l'utilisateur (déjà
 * authentifié + filtré par requireRole en amont) n'est pas assigné
 * comme formateur sur au moins une formation. Permet aux admins
 * assignés d'accéder à l'espace formateur, et bloque les trainers
 * non assignés.
 */
export function ensureAssignedTrainer() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return next(new ForbiddenError());

      const assigned = await userIsAssignedTrainer(userId);
      if (!assigned) {
        return next(
          new ForbiddenError("Vous n'êtes assigné à aucune formation comme formateur"),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
