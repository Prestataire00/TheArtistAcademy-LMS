import { prisma } from '../../config/database';
import { supabase, RESOURCES_BUCKET } from '../../config/supabase';
import { NotFoundError, BadRequestError } from '../../shared/errors';

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

  const ext = file.originalname.split('.').pop() || 'pdf';
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
      fileName: file.originalname,
      fileUrl: storagePath,
      fileType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedAt: new Date(),
    },
    create: {
      uaId,
      fileName: file.originalname,
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
  if (!resource) throw new NotFoundError('Ressource');

  // Supprimer du Storage
  await supabase.storage.from(RESOURCES_BUCKET).remove([resource.fileUrl]);

  // Supprimer en base
  await prisma.resource.delete({ where: { uaId } });
}

// ─── Player ───────────────────────────────────────────────────────────────────

export async function getFormationResources(formationId: string) {
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          uas: {
            where: { type: 'resource' },
            orderBy: { position: 'asc' },
            include: { resource: true },
          },
        },
      },
    },
  });
  if (!formation) throw new NotFoundError('Formation');

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

export async function markResourceCompleted(enrollmentId: string, uaId: string) {
  const now = new Date();
  await prisma.uAProgress.upsert({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
    update: { status: 'completed', completedAt: now },
    create: {
      enrollmentId,
      uaId,
      status: 'completed',
      firstAccessedAt: now,
      completedAt: now,
    },
  });
}
