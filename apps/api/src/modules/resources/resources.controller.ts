import { Request, Response } from 'express';
import * as service from './resources.service';
import { verifyLearnerAccess } from '../../shared/enrollment.guard';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { prisma } from '../../config/database';

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminUpload(req: Request, res: Response) {
  const uaId = req.params.id;
  const file = req.file;
  if (!file) throw new BadRequestError('Fichier manquant');

  const result = await service.uploadResource(uaId, file);

  await logEvent({
    category: 'admin',
    action: 'resource_upload',
    userId: req.user!.userId,
    entityType: 'resource',
    entityId: result.id,
    payload: { uaId, fileName: result.fileName, fileType: result.fileType, fileSizeBytes: result.fileSizeBytes },
  });

  res.status(201).json({ data: result });
}

export async function adminDelete(req: Request, res: Response) {
  const uaId = req.params.id;

  await service.deleteResource(uaId);

  await logEvent({
    category: 'admin',
    action: 'resource_delete',
    userId: req.user!.userId,
    entityType: 'ua',
    entityId: uaId,
  });

  res.status(204).end();
}

// ─── Player ───────────────────────────────────────────────────────────────────

export async function playerListResources(req: Request, res: Response) {
  const formationId = req.params.id;
  const userId = req.user!.userId;

  // Vérifier enrollment actif
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      formationId,
      status: 'active',
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });
  if (!enrollment) {
    throw new BadRequestError("Vous n'avez pas d'inscription active pour cette formation");
  }

  const resources = await service.getFormationResources(formationId);
  res.json({ data: resources });
}

export async function playerDownload(req: Request, res: Response) {
  const resourceId = req.params.id;
  const userId = req.user!.userId;

  const { signedUrl, resource } = await service.generateDownloadUrl(resourceId);

  // Vérifier enrollment actif via l'UA liée
  const { enrollment } = await verifyLearnerAccess(userId, resource.uaId);

  // Marquer l'UA comme completed (ouverture = complétion pour une ressource)
  await service.markResourceCompleted(enrollment.id, resource.uaId);

  // Log — sans l'URL signée
  await logEvent({
    category: 'navigation',
    action: 'resource_downloaded',
    userId,
    enrollmentId: enrollment.id,
    entityType: 'resource',
    entityId: resourceId,
    payload: { fileName: resource.fileName, uaId: resource.uaId },
  });

  res.json({ data: { signedUrl, fileName: resource.fileName } });
}
