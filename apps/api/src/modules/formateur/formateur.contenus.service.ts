import { prisma } from '../../config/database';

/**
 * Liste les formations dont le formateur est responsable (trainerId),
 * avec leurs UAs de type quiz et resource editables.
 *
 * Règle métier (validée — voir table de vérité dans le PR/commit) :
 *   - Formation visible ssi : `trainerId match` ET `isPublished: true`.
 *     Brouillon → masquée. Nombre d'inscrits non pertinent.
 *   - Module visible ssi : `isPublished: true` (modules brouillons masqués).
 *   - UA visible ssi : `isPublished: true` (UAs brouillons masquées) ET
 *     `type ∈ {quiz, resource}` (le frontend formateur ne sait pas éditer
 *     d'autres types).
 *
 * On ne filtre PAS sur la présence d'au moins une UA éditable : on retourne
 * `modules: []` plutôt que de masquer la formation (sinon le formateur
 * croirait à une absence d'assignation).
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
            where: { isPublished: true, type: { in: ['quiz', 'resource'] } },
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
