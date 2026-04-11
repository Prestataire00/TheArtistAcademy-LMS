import { prisma } from '../../config/database';

/**
 * Liste les formations dont le formateur est responsable (trainerId),
 * avec leurs UAs de type quiz et resource editables.
 */
export async function listEditableContent(trainerId: string) {
  const formations = await prisma.formation.findMany({
    where: { trainerId },
    orderBy: { title: 'asc' },
    include: {
      modules: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        include: {
          uas: {
            where: { type: { in: ['quiz', 'resource'] } },
            orderBy: { position: 'asc' },
            include: {
              quiz: { select: { id: true, _count: { select: { questions: true } } } },
              resource: { select: { id: true, fileName: true, fileType: true, fileSizeBytes: true } },
            },
          },
        },
      },
    },
  });

  return formations
    .filter((f) => f.modules.some((m) => m.uas.length > 0))
    .map((f) => ({
      formationId: f.id,
      title: f.title,
      modules: f.modules
        .filter((m) => m.uas.length > 0)
        .map((m) => ({
          moduleId: m.id,
          title: m.title,
          uas: m.uas.map((ua) => ({
            id: ua.id,
            title: ua.title,
            type: ua.type,
            quiz: ua.quiz ? {
              id: ua.quiz.id,
              questionsCount: ua.quiz._count.questions,
            } : null,
            resource: ua.resource ? {
              id: ua.resource.id,
              fileName: ua.resource.fileName,
              fileType: ua.resource.fileType,
              fileSizeBytes: ua.resource.fileSizeBytes,
            } : null,
          })),
        })),
    }));
}
