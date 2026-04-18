import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './videos.service';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError } from '../../shared/errors';
import { sendProgressionToDendreo } from '../dendreo/dendreo.progression.service';

// ─── Admin — Upload vidéo ─────────────────────────────────────────────────────

export async function adminUpload(req: Request, res: Response) {
  const uaId = req.params.id;
  const file = req.file;

  if (!file) throw new BadRequestError('Fichier vidéo manquant');

  const durationSeconds = req.body.durationSeconds
    ? parseInt(req.body.durationSeconds, 10)
    : undefined;

  const result = await service.uploadVideo(uaId, file, durationSeconds);

  // Log l'upload — ne PAS inclure d'URL
  await logEvent({
    category: 'admin',
    action: 'video_upload',
    userId: req.user!.userId,
    entityType: 'ua',
    entityId: uaId,
    payload: {
      originalName: result.originalName,
      mimeType: result.mimeType,
      fileSizeBytes: result.fileSizeBytes,
      durationSeconds: result.durationSeconds,
    },
  });

  res.status(201).json({ data: result });
}

// ─── Player — Stream (signed URL) ────────────────────────────────────────────

export async function playerStream(req: Request, res: Response) {
  const uaId = req.params.id;
  const userId = req.user!.userId;

  // Vérifie l'inscription active
  await service.verifyLearnerAccess(userId, uaId);

  // Génère une signed URL fraîche
  const signedUrl = await service.createSignedUrl(uaId);

  // Log la demande de stream — sans l'URL
  await logEvent({
    category: 'video',
    action: 'video_stream_request',
    userId,
    entityType: 'ua',
    entityId: uaId,
  });

  res.json({ data: { signedUrl } });
}

// ─── Player — Save progress ──────────────────────────────────────────────────

const progressSchema = z.object({
  positionSeconds: z.number().int().min(0),
  percentWatched: z.number().min(0).max(100),
});

export async function playerSaveProgress(req: Request, res: Response) {
  const uaId = req.params.id;
  const userId = req.user!.userId;

  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map(e => e.message).join(', '));

  // Vérifie l'inscription active + récupère le seuil de complétion
  const { enrollment, formation } = await service.verifyLearnerAccess(userId, uaId);

  const result = await service.saveVideoProgress(
    enrollment.id,
    uaId,
    parsed.data.positionSeconds,
    parsed.data.percentWatched,
    formation.videoCompletionThreshold,
  );

  // Log seulement les changements de statut significatifs
  if (result.status === 'completed' && result.completedAt) {
    await logEvent({
      category: 'video',
      action: 'video_completed',
      userId,
      enrollmentId: enrollment.id,
      entityType: 'ua',
      entityId: uaId,
      payload: {
        percentWatched: parsed.data.percentWatched,
        threshold: formation.videoCompletionThreshold,
      },
    });
  }

  // Envoyer la progression à Dendreo en arrière-plan
  sendProgressionToDendreo(enrollment.id);

  res.json({ data: result });
}

// ─── Player — Get progress (reprise) ─────────────────────────────────────────

export async function playerGetProgress(req: Request, res: Response) {
  const uaId = req.params.id;
  const userId = req.user!.userId;

  const { enrollment } = await service.verifyLearnerAccess(userId, uaId);
  const result = await service.getVideoProgress(enrollment.id, uaId);

  res.json({ data: result });
}
