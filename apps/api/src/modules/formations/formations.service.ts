import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../shared/errors';

export async function listFormations() {
  const formations = await prisma.formation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          modules: true,
          enrollments: { where: { status: 'active' } },
        },
      },
      trainer: { select: { id: true, fullName: true, email: true } },
    },
  });
  return formations.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    thumbnailUrl: f.thumbnailUrl,
    pathwayMode: f.pathwayMode,
    videoCompletionThreshold: f.videoCompletionThreshold,
    isPublished: f.isPublished,
    trainerId: f.trainerId,
    trainerName: f.trainer?.fullName ?? null,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    modulesCount: f._count.modules,
    enrollmentsCount: f._count.enrollments,
  }));
}

export async function getFormation(id: string) {
  const formation = await prisma.formation.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          uas: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  if (!formation) throw new NotFoundError('Formation');

  return {
    id: formation.id,
    title: formation.title,
    description: formation.description,
    thumbnailUrl: formation.thumbnailUrl,
    pathwayMode: formation.pathwayMode,
    videoCompletionThreshold: formation.videoCompletionThreshold,
    isPublished: formation.isPublished,
    createdAt: formation.createdAt.toISOString(),
    updatedAt: formation.updatedAt.toISOString(),
    modules: formation.modules.map((m) => ({
      id: m.id,
      formationId: m.formationId,
      title: m.title,
      description: m.description,
      position: m.position,
      isPublished: m.isPublished,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      uas: m.uas.map((ua) => ({
        id: ua.id,
        moduleId: ua.moduleId,
        title: ua.title,
        type: ua.type,
        position: ua.position,
        isPublished: ua.isPublished,
        createdAt: ua.createdAt.toISOString(),
        updatedAt: ua.updatedAt.toISOString(),
      })),
    })),
  };
}

export async function createFormation(data: {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  pathwayMode?: 'linear' | 'free';
  videoCompletionThreshold?: number;
  isPublished?: boolean;
  trainerId?: string | null;
}) {
  return prisma.formation.create({ data });
}

export async function updateFormation(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    pathwayMode?: 'linear' | 'free';
    videoCompletionThreshold?: number;
    isPublished?: boolean;
    trainerId?: string | null;
  },
) {
  const exists = await prisma.formation.findUnique({ where: { id } });
  if (!exists) throw new NotFoundError('Formation');
  return prisma.formation.update({ where: { id }, data });
}

export async function deleteFormation(id: string) {
  const exists = await prisma.formation.findUnique({
    where: { id },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!exists) throw new NotFoundError('Formation');
  if (exists._count.enrollments > 0) {
    throw new BadRequestError(
      `Impossible de supprimer : ${exists._count.enrollments} inscription(s) liée(s) à cette formation`,
    );
  }
  await prisma.formation.delete({ where: { id } });
}

export async function duplicateFormation(id: string) {
  const source = await prisma.formation.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          uas: {
            orderBy: { position: 'asc' },
            include: { videoContent: true, quiz: { include: { questions: { include: { choices: true } } } }, resource: true },
          },
        },
      },
    },
  });
  if (!source) throw new NotFoundError('Formation');

  const newFormation = await prisma.formation.create({
    data: {
      title: `${source.title} (copie)`,
      description: source.description,
      thumbnailUrl: source.thumbnailUrl,
      pathwayMode: source.pathwayMode,
      videoCompletionThreshold: source.videoCompletionThreshold,
      isPublished: false,
    },
  });

  for (const mod of source.modules) {
    const newModule = await prisma.module.create({
      data: {
        formationId: newFormation.id,
        title: mod.title,
        description: mod.description,
        position: mod.position,
        isPublished: mod.isPublished,
      },
    });

    for (const ua of mod.uas) {
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
          const newQuestion = await prisma.quizQuestion.create({
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
                questionId: newQuestion.id,
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
  }

  return getFormation(newFormation.id);
}
