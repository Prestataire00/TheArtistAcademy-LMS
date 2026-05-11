import type { CompletionStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { supabase, RESOURCES_BUCKET } from '../../config/supabase';
import { NotFoundError, BadRequestError } from '../../shared/errors';
import { computePathwayLocks } from '../../shared/pathway';
import { lookupCountry } from '../../shared/geo';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const SIGNED_DOWNLOAD_TTL = 15 * 60; // 15 minutes

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function uploadResource(
  uaId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
) {
  // Vérifier UA
  const ua = await prisma.uA.findUnique({ where: { id: uaId } });
  if (!ua) throw new NotFoundError('UA');
  if (ua.type !== 'resource') throw new BadRequestError("Cette UA n'est pas de type resource");

  // Vérifier format
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    throw new BadRequestError('Format non accepté. Formats autorisés : PDF, PPT, PPTX');
  }

  // Fix encodage: multer encode les noms en latin1, on decode en utf8
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

  const ext = originalName.split('.').pop() || 'pdf';
  const storagePath = `${uaId}/${Date.now()}.${ext}`;

  // Supprimer l'ancienne ressource si elle existe
  const existing = await prisma.resource.findUnique({ where: { uaId } });
  if (existing) {
    await supabase.storage.from(RESOURCES_BUCKET).remove([existing.fileUrl]);
  }

  // Upload vers Supabase Storage (bucket privé)
  const { error: uploadError } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new BadRequestError(`Erreur upload: ${uploadError.message}`);
  }

  // Upsert Resource en base
  const resource = await prisma.resource.upsert({
    where: { uaId },
    update: {
      fileName: originalName,
      fileUrl: storagePath,
      fileType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedAt: new Date(),
    },
    create: {
      uaId,
      fileName: originalName,
      fileUrl: storagePath,
      fileType: file.mimetype,
      fileSizeBytes: file.size,
    },
  });

  return {
    id: resource.id,
    uaId: resource.uaId,
    fileName: resource.fileName,
    fileType: resource.fileType,
    fileSizeBytes: resource.fileSizeBytes,
    uploadedAt: resource.uploadedAt.toISOString(),
  };
}

export async function deleteResource(uaId: string) {
  const resource = await prisma.resource.findUnique({ where: { uaId } });
  if (!resource) return; // Deja supprimee — idempotent

  // Supprimer du Storage
  await supabase.storage.from(RESOURCES_BUCKET).remove([resource.fileUrl]);

  // Supprimer en base
  await prisma.resource.delete({ where: { uaId } });
}

// ─── Player ───────────────────────────────────────────────────────────────────

export async function getFormationResources(formationId: string, enrollmentId: string) {
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    include: {
      // On a besoin de TOUS les UAs publiés (pas seulement type=resource) pour
      // calculer correctement la linéarité — un UA quiz/vidéo qui précède une
      // ressource doit être complété pour la déverrouiller.
      modules: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        include: {
          uas: {
            where: { isPublished: true },
            orderBy: { position: 'asc' },
            include: { resource: true },
          },
        },
      },
    },
  });
  if (!formation) throw new NotFoundError('Formation');

  // Statuts de progression pour cet enrollment → input du calcul de locks.
  const uaProgresses = await prisma.uAProgress.findMany({
    where: { enrollmentId },
    select: { uaId: true, status: true },
  });
  const statusMap = new Map<string, CompletionStatus>(uaProgresses.map((p) => [p.uaId, p.status]));

  const { uaLocks } = computePathwayLocks(
    formation.pathwayMode as 'linear' | 'free',
    formation.modules.map((m) => ({
      id: m.id,
      position: m.position,
      uas: m.uas.map((u) => ({ id: u.id, position: u.position })),
    })),
    statusMap,
  );

  const byModule = formation.modules
    .filter((m) => m.uas.some((ua) => ua.resource))
    .map((m) => ({
      moduleId: m.id,
      moduleTitle: m.title,
      position: m.position,
      resources: m.uas
        .filter((ua) => ua.resource)
        .map((ua) => ({
          id: ua.resource!.id,
          uaId: ua.id,
          uaTitle: ua.title,
          fileName: ua.resource!.fileName,
          fileType: ua.resource!.fileType,
          fileSizeBytes: ua.resource!.fileSizeBytes,
          isLocked: uaLocks.get(ua.id) ?? false,
        })),
    }));

  const all = byModule.flatMap((m) => m.resources);

  return { byModule, all };
}

export async function generateDownloadUrl(resourceId: string): Promise<{ signedUrl: string; resource: any }> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { ua: true },
  });
  if (!resource) throw new NotFoundError('Ressource');

  const { data, error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .createSignedUrl(resource.fileUrl, SIGNED_DOWNLOAD_TTL, {
      download: resource.fileName,
    });

  if (error || !data?.signedUrl) {
    throw new BadRequestError('Impossible de générer le lien de téléchargement');
  }

  return { signedUrl: data.signedUrl, resource };
}

export async function generatePreviewUrlByUaId(uaId: string): Promise<{ signedUrl: string; fileName: string }> {
  const resource = await prisma.resource.findUnique({ where: { uaId } });
  if (!resource) throw new NotFoundError('Ressource');

  const { data, error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .createSignedUrl(resource.fileUrl, SIGNED_DOWNLOAD_TTL);

  if (error || !data?.signedUrl) {
    throw new BadRequestError('Impossible de generer le lien de previsualisation');
  }

  return { signedUrl: data.signedUrl, fileName: resource.fileName };
}

/**
 * Signed URL pour viewer inline côté apprenant (iframe/img/video).
 * Pas d'option `download` → Content-Disposition: inline → le browser rend
 * le fichier au lieu de le télécharger.
 */
export async function generatePreviewUrlByResourceId(
  resourceId: string,
): Promise<{ signedUrl: string; resource: { uaId: string; fileName: string; fileType: string } }> {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw new NotFoundError('Ressource');

  const { data, error } = await supabase.storage
    .from(RESOURCES_BUCKET)
    .createSignedUrl(resource.fileUrl, SIGNED_DOWNLOAD_TTL);

  if (error || !data?.signedUrl) {
    throw new BadRequestError('Impossible de générer le lien de prévisualisation');
  }

  return {
    signedUrl: data.signedUrl,
    resource: { uaId: resource.uaId, fileName: resource.fileName, fileType: resource.fileType },
  };
}

export async function markResourceCompleted(
  enrollmentId: string,
  uaId: string,
  meta?: { ipAddress?: string | null },
) {
  const now = new Date();

  // Phase 2 — capture IP + pays UNIQUEMENT au PREMIER passage à `completed`
  // (jamais écrasés ensuite). Quand Phase 1 implémentera la transition
  // not_started → in_progress, étendre ici pour capturer aussi à ce moment-là.
  const existing = await prisma.uAProgress.findUnique({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
    select: { ipAddress: true },
  });
  const captureGeo = !existing?.ipAddress && meta?.ipAddress
    ? { ipAddress: meta.ipAddress, country: lookupCountry(meta.ipAddress) }
    : {};

  await prisma.uAProgress.upsert({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
    update: { status: 'completed', completedAt: now, ...captureGeo },
    create: {
      enrollmentId,
      uaId,
      status: 'completed',
      firstAccessedAt: now,
      completedAt: now,
      ...captureGeo,
    },
  });
}
