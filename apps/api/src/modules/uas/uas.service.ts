import { UAType } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';

export async function listUAs(moduleId: string) {
  const uas = await prisma.uA.findMany({
    where: { moduleId },
    orderBy: { position: 'asc' },
  });
  return uas.map(toDto);
}

export async function getUA(id: string) {
  const ua = await prisma.uA.findUnique({ where: { id } });
  if (!ua) throw new NotFoundError('UA');
  return toDto(ua);
}

export async function createUA(data: {
  moduleId: string;
  title: string;
  type: UAType;
  isPublished?: boolean;
}) {
  // Vérifie que le module existe
  const mod = await prisma.module.findUnique({ where: { id: data.moduleId } });
  if (!mod) throw new NotFoundError('Module');

  // Position = dernier + 1
  const last = await prisma.uA.findFirst({
    where: { moduleId: data.moduleId },
    orderBy: { position: 'desc' },
  });

  const ua = await prisma.uA.create({
    data: { ...data, position: (last?.position ?? -1) + 1 },
  });

  // Crée l'entité contenu vide selon le type
  if (data.type === 'quiz') {
    await prisma.quiz.create({
      data: { uaId: ua.id, title: data.title },
    });
  }

  return toDto(ua);
}

export async function updateUA(
  id: string,
  data: { title?: string; isPublished?: boolean },
) {
  const exists = await prisma.uA.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError('UA');
  const ua = await prisma.uA.update({ where: { id }, data });
  return toDto(ua);
}

export async function deleteUA(id: string) {
  const exists = await prisma.uA.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError('UA');
  await prisma.uA.delete({ where: { id } });
}

function toDto(ua: any) {
  return {
    id: ua.id,
    moduleId: ua.moduleId,
    title: ua.title,
    type: ua.type,
    position: ua.position,
    isPublished: ua.isPublished,
    createdAt: ua.createdAt.toISOString(),
    updatedAt: ua.updatedAt.toISOString(),
  };
}
