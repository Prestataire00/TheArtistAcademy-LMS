import { prisma } from '../../config/database';

/**
 * Liste les formations dont le formateur est responsable (trainerId),
 * avec leurs UAs de type quiz et resource editables.
 *
 * Conditions sur la formation : trainerId + isPublished. On ne filtre
 * PAS sur la présence d'au moins un module / une UA éditable : un
 * formateur doit voir ses formations publiées même quand il n'y a rien
 * à éditer (modules: [] dans la réponse), pour signaler explicitement
 * qu'il n'a pas encore de contenu à gérer (au lieu de masquer la
 * formation, ce qui faisait croire à une absence d'assignation).
 *
 * Les modules en brouillon et les UAs autres que quiz/resource sont
 * filtrés à l'include (c'est de la responsabilité admin, pas formateur).
 */
export async function listEditableContent(trainerId: string) {
  const formations = await prisma.formation.findMany({
    where: { trainerId, isPublished: true },
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

  return formations.map((f) => ({
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
