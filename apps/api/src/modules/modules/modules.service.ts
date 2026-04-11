import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';

export async function listModules(formationId: string) {
  const modules = await prisma.module.findMany({
    where: { formationId },
    orderBy: { position: 'asc' },
    include: { uas: { orderBy: { position: 'asc' } } },
  });
  return modules.map(toDto);
}

export async function getModule(id: string) {
  const mod = await prisma.module.findUnique({
    where: { id },
    include: {
      uas: {
        orderBy: { position: 'asc' },
        include: {
          resource: { select: { id: true, fileName: true, fileType: true, fileSizeBytes: true } },
          videoContent: { select: { id: true, originalName: true, durationSeconds: true } },
        },
      },
    },
  });
  if (!mod) throw new NotFoundError('Module');
  return toDto(mod);
}

export async function createModule(data: {
  formationId: string;
  title: string;
  description?: string;
  isPublished?: boolean;
}) {
  // Vérifie que la formation existe
  const formation = await prisma.formation.findUnique({ where: { id: data.formationId } });
  if (!formation) throw new NotFoundError('Formation');

  // Position = dernier + 1
  const last = await prisma.module.findFirst({
    where: { formationId: data.formationId },
    orderBy: { position: 'desc' },
  });

  return prisma.module.create({
    data: { ...data, position: (last?.position ?? -1) + 1 },
    include: { uas: true },
  });
}

export async function updateModule(
  id: string,
  data: { title?: string; description?: string | null; isPublished?: boolean },
) {
  const exists = await prisma.module.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError('Module');
  return prisma.module.update({
    where: { id },
    data,
    include: { uas: { orderBy: { position: 'asc' } } },
  });
}

export async function deleteModule(id: string) {
  const exists = await prisma.module.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError('Module');
  await prisma.module.delete({ where: { id } });
}

export async function reorderModules(formationId: string, orderedIds: string[]) {
  // Vérifie que tous les ids appartiennent à cette formation
  const existing = await prisma.module.findMany({
    where: { formationId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((m) => m.id));
  for (const id of orderedIds) {
    if (!existingIds.has(id)) throw new NotFoundError(`Module ${id}`);
  }

  // Update position dans une transaction
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.module.update({ where: { id }, data: { position: index } }),
    ),
  );

  return listModules(formationId);
}

export async function duplicateModule(id: string) {
  const source = await prisma.module.findUnique({
    where: { id },
    include: {
      uas: {
        orderBy: { position: 'asc' },
        include: {
          videoContent: true,
          quiz: { include: { questions: { include: { choices: true } } } },
          resource: true,
        },
      },
    },
  });
  if (!source) throw new NotFoundError('Module');

  // Position = dernier + 1
  const last = await prisma.module.findFirst({
    where: { formationId: source.formationId },
    orderBy: { position: 'desc' },
  });

  const newModule = await prisma.module.create({
    data: {
      formationId: source.formationId,
      title: `${source.title} (copie)`,
      description: source.description,
      position: (last?.position ?? -1) + 1,
      isPublished: false,
    },
  });

  for (const ua of source.uas) {
    const newUA = await prisma.uA.create({
      data: {
        moduleId: newModule.id,
        title: ua.title,
        type: ua.type,
        position: ua.position,
        isPublished: ua.isPublished,
      },
    });

    if (ua.videoContent) {
      await prisma.videoContent.create({
        data: {
          uaId: newUA.id,
          storagePath: ua.videoContent.storagePath,
          originalName: ua.videoContent.originalName,
          mimeType: ua.videoContent.mimeType,
          fileSizeBytes: ua.videoContent.fileSizeBytes,
          durationSeconds: ua.videoContent.durationSeconds,
          thumbnailUrl: ua.videoContent.thumbnailUrl,
        },
      });
    }
    if (ua.quiz) {
      const newQuiz = await prisma.quiz.create({
        data: { uaId: newUA.id, title: ua.quiz.title, instructions: ua.quiz.instructions },
      });
      for (const q of ua.quiz.questions) {
        const newQ = await prisma.quizQuestion.create({
          data: {
            quizId: newQuiz.id,
            questionText: q.questionText,
            type: q.type,
            position: q.position,
            points: q.points,
          },
        });
        if (q.choices.length > 0) {
          await prisma.quizChoice.createMany({
            data: q.choices.map((c) => ({
              questionId: newQ.id,
              choiceText: c.choiceText,
              isCorrect: c.isCorrect,
            })),
          });
        }
      }
    }
    if (ua.resource) {
      await prisma.resource.create({
        data: {
          uaId: newUA.id,
          fileName: ua.resource.fileName,
          fileUrl: ua.resource.fileUrl,
          fileType: ua.resource.fileType,
          fileSizeBytes: ua.resource.fileSizeBytes,
        },
      });
    }
  }

  return getModule(newModule.id);
}

function toDto(mod: any) {
  return {
    id: mod.id,
    formationId: mod.formationId,
    title: mod.title,
    description: mod.description,
    position: mod.position,
    isPublished: mod.isPublished,
    createdAt: mod.createdAt.toISOString(),
    updatedAt: mod.updatedAt.toISOString(),
    uas: (mod.uas || []).map((ua: any) => ({
      id: ua.id,
      moduleId: ua.moduleId,
      title: ua.title,
      type: ua.type,
      position: ua.position,
      isPublished: ua.isPublished,
      createdAt: ua.createdAt.toISOString(),
      updatedAt: ua.updatedAt.toISOString(),
      resource: ua.resource ? { id: ua.resource.id, fileName: ua.resource.fileName, fileType: ua.resource.fileType, fileSizeBytes: ua.resource.fileSizeBytes } : null,
      videoContent: ua.videoContent ? { id: ua.videoContent.id, originalName: ua.videoContent.originalName, durationSeconds: ua.videoContent.durationSeconds } : null,
    })),
  };
}
