import { prisma } from '../../config/database';
import { supabase, STORAGE_BUCKET, SIGNED_URL_EXPIRES_IN } from '../../config/supabase';
import { NotFoundError, BadRequestError } from '../../shared/errors';
import { logger } from '../../shared/logger';

/**
 * Upload une vidéo vers Supabase Storage et crée/met à jour le VideoContent.
 */
export async function uploadVideo(
  uaId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  durationSeconds?: number,
) {
  // Vérifie que l'UA existe et est de type video
  const ua = await prisma.uA.findUnique({ where: { id: uaId } });
  if (!ua) throw new NotFoundError('UA');
  if (ua.type !== 'video') throw new BadRequestError("Cette UA n'est pas de type vidéo");

  // Fix encodage: multer encode les noms en latin1, on decode en utf8
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

  const ext = originalName.split('.').pop() || 'mp4';
  const storagePath = `${uaId}/${Date.now()}.${ext}`;

  // Upload vers Supabase Storage (bucket privé)
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new BadRequestError(`Erreur upload Supabase: ${uploadError.message}`);
  }

  // Supprimer l'ancien fichier s'il existe
  const existingVideo = await prisma.videoContent.findUnique({ where: { uaId } });
  if (existingVideo) {
    await supabase.storage.from(STORAGE_BUCKET).remove([existingVideo.storagePath]);
  }

  // Upsert VideoContent
  const videoContent = await prisma.videoContent.upsert({
    where: { uaId },
    update: {
      storagePath,
      originalName,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      durationSeconds: durationSeconds ?? null,
      uploadedAt: new Date(),
    },
    create: {
      uaId,
      storagePath,
      originalName,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      durationSeconds: durationSeconds ?? null,
    },
  });

  return {
    id: videoContent.id,
    uaId: videoContent.uaId,
    originalName: videoContent.originalName,
    mimeType: videoContent.mimeType,
    fileSizeBytes: videoContent.fileSizeBytes,
    durationSeconds: videoContent.durationSeconds,
    uploadedAt: videoContent.uploadedAt.toISOString(),
  };
}

/**
 * Génère une signed URL Supabase Storage (2h par défaut).
 * Ne jamais exposer le storagePath brut ni l'URL dans les logs.
 */
export async function createSignedUrl(uaId: string): Promise<string> {
  const video = await prisma.videoContent.findUnique({ where: { uaId } });
  if (!video) throw new NotFoundError('Vidéo');

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(video.storagePath, SIGNED_URL_EXPIRES_IN);

  if (error || !data?.signedUrl) {
    throw new BadRequestError('Impossible de générer l\'URL de streaming');
  }

  return data.signedUrl;
}

// verifyLearnerAccess déplacé dans shared/enrollment.guard.ts
export { verifyLearnerAccess } from '../../shared/enrollment.guard';

/**
 * Sauvegarde la progression vidéo et calcule le statut UA.
 */
export async function saveVideoProgress(
  enrollmentId: string,
  uaId: string,
  positionSeconds: number,
  percentWatched: number,
  completionThreshold: number,
) {
  const now = new Date();
  const isCompleted = percentWatched >= completionThreshold;

  // Debug log (temporaire)
  logger.debug('Video progress', {
    uaId,
    positionSeconds,
    percentWatched,
    completionThreshold,
    isCompleted,
  });

  // Ne pas regresser un statut deja completed
  const existing = await prisma.uAProgress.findUnique({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
  });
  const alreadyCompleted = existing?.status === 'completed';

  const progress = await prisma.uAProgress.upsert({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
    update: {
      videoPositionSeconds: positionSeconds,
      videoPercentWatched: percentWatched,
      status: alreadyCompleted ? 'completed' : (isCompleted ? 'completed' : 'in_progress'),
      completedAt: (alreadyCompleted || isCompleted) ? (existing?.completedAt ?? now) : undefined,
      timeSpentSeconds: { increment: 10 }, // heartbeat interval = 10s
    },
    create: {
      enrollmentId,
      uaId,
      videoPositionSeconds: positionSeconds,
      videoPercentWatched: percentWatched,
      status: isCompleted ? 'completed' : 'in_progress',
      firstAccessedAt: now,
      completedAt: isCompleted ? now : null,
      timeSpentSeconds: 10,
    },
  });

  return {
    uaId: progress.uaId,
    status: progress.status,
    videoPositionSeconds: progress.videoPositionSeconds,
    videoPercentWatched: progress.videoPercentWatched,
    timeSpentSeconds: progress.timeSpentSeconds,
    completedAt: progress.completedAt?.toISOString() ?? null,
  };
}

/**
 * Retourne la dernière position de lecture pour la reprise.
 */
export async function getVideoProgress(enrollmentId: string, uaId: string) {
  const progress = await prisma.uAProgress.findUnique({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
  });

  return {
    uaId,
    videoPositionSeconds: progress?.videoPositionSeconds ?? 0,
    videoPercentWatched: progress?.videoPercentWatched ?? 0,
    status: progress?.status ?? 'not_started',
    timeSpentSeconds: progress?.timeSpentSeconds ?? 0,
    completedAt: progress?.completedAt?.toISOString() ?? null,
  };
}
