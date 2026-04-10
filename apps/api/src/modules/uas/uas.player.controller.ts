import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { verifyLearnerAccess } from '../../shared/enrollment.guard';
import { NotFoundError } from '../../shared/errors';

/**
 * GET /api/v1/player/uas/:id — Retourne les metadonnées d'une UA pour l'apprenant.
 */
export async function playerGetUA(req: Request, res: Response) {
  const uaId = req.params.id;
  const userId = req.user!.userId;

  const { ua, formation } = await verifyLearnerAccess(userId, uaId);

  const videoContent = ua.type === 'video'
    ? await prisma.videoContent.findUnique({ where: { uaId }, select: { durationSeconds: true } })
    : null;

  res.json({
    data: {
      id: ua.id,
      title: ua.title,
      type: ua.type,
      formationId: formation.id,
      formationTitle: formation.title,
      durationSeconds: videoContent?.durationSeconds ?? null,
    },
  });
}
