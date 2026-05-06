import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../shared/errors';
import { CompletionStatus } from '@prisma/client';
import { logger } from '../../shared/logger';
import { computePathwayLocks } from '../../shared/pathway';

/**
 * Retourne les données complètes de la formation pour un apprenant :
 * formation, modules, UAs, progression, enrollment.
 */
export async function getPlayerFormation(userId: string, formationId: string) {
  // Lookup d'abord l'enrollment sans filtre date/status pour donner un message
  // précis selon la cause d'inactivité (sinon "pas d'inscription active" couvre
  // 4 cas distincts et bloque le diagnostic).
  const now = new Date();
  const anyEnrollment = await prisma.enrollment.findFirst({
    where: { userId, formationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!anyEnrollment) {
    // Diagnostic : logger ce que l'API voit en DB pour ce user
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, roles: true },
    });
    const allEnrollmentsForUser = await prisma.enrollment.findMany({
      where: { userId },
      select: { id: true, formationId: true, status: true },
    });
    const formationExists = await prisma.formation.findUnique({
      where: { id: formationId },
      select: { id: true, title: true },
    });
    logger.warn('[player] enrollment introuvable — diagnostic', {
      requestedUserId: userId,
      requestedFormationId: formationId,
      userInDb: userExists,
      formationInDb: formationExists,
      allEnrollmentsForUserCount: allEnrollmentsForUser.length,
      allEnrollmentsForUser,
    });
    throw new BadRequestError("Aucune inscription trouvée pour cette formation");
  }

  if (anyEnrollment.status !== 'active') {
    throw new BadRequestError(
      `Inscription au statut "${anyEnrollment.status}" — l'accès à la formation n'est pas ouvert`,
    );
  }

  if (anyEnrollment.startDate > now) {
    throw new BadRequestError(
      `Accès non encore ouvert — débute le ${anyEnrollment.startDate.toISOString().slice(0, 10)}`,
    );
  }

  if (anyEnrollment.endDate < now) {
    throw new BadRequestError(
      `Accès expiré — terminé le ${anyEnrollment.endDate.toISOString().slice(0, 10)}`,
    );
  }

  const enrollment = anyEnrollment;

  // Charger la formation complète
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    include: {
      modules: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        include: {
          uas: {
            where: { isPublished: true },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });
  if (!formation) throw new NotFoundError('Formation');

  // Charger toutes les progressions de cet enrollment
  const [uaProgresses, formationProgress] = await Promise.all([
    prisma.uAProgress.findMany({ where: { enrollmentId: enrollment.id } }),
    prisma.formationProgress.findUnique({ where: { enrollmentId: enrollment.id } }),
  ]);

  const uaProgressMap = new Map(uaProgresses.map((p) => [p.uaId, p]));
  const uaStatusMap = new Map<string, CompletionStatus>(
    uaProgresses.map((p) => [p.uaId, p.status]),
  );

  const { moduleLocks, uaLocks } = computePathwayLocks(
    formation.pathwayMode,
    formation.modules.map((m) => ({
      id: m.id,
      position: m.position,
      uas: m.uas.map((u) => ({ id: u.id, position: u.position })),
    })),
    uaStatusMap,
  );

  // Construire les modules avec progression
  let totalUAs = 0;
  let completedUAs = 0;
  let totalTimeSpent = 0;
  let firstIncompleteUaId: string | null = null;

  const modules = formation.modules.map((mod) => {
    let moduleCompleted = 0;
    let moduleTotal = 0;

    const uas = mod.uas.map((ua) => {
      moduleTotal++;
      totalUAs++;
      const progress = uaProgressMap.get(ua.id);
      const status: CompletionStatus = progress?.status ?? 'not_started';

      if (status === 'completed') {
        moduleCompleted++;
        completedUAs++;
      }

      const uaLocked = uaLocks.get(ua.id) ?? false;
      // Continuer = première UA non terminée ET non verrouillée
      if (!firstIncompleteUaId && status !== 'completed' && !uaLocked) {
        firstIncompleteUaId = ua.id;
      }

      if (progress) {
        totalTimeSpent += progress.timeSpentSeconds;
      }

      return {
        id: ua.id,
        title: ua.title,
        type: ua.type,
        position: ua.position,
        status,
        isLocked: uaLocked,
      };
    });

    const moduleProgressPercent = moduleTotal > 0 ? Math.round((moduleCompleted / moduleTotal) * 100) : 0;
    const moduleStatus: CompletionStatus =
      moduleCompleted === 0 ? 'not_started' :
      moduleCompleted >= moduleTotal ? 'completed' :
      'in_progress';

    return {
      id: mod.id,
      title: mod.title,
      description: mod.description,
      position: mod.position,
      status: moduleStatus,
      progressPercent: moduleProgressPercent,
      isLocked: moduleLocks.get(mod.id) ?? false,
      uas,
    };
  });

  const globalProgressPercent = totalUAs > 0 ? Math.round((completedUAs / totalUAs) * 100) : 0;
  const globalStatus: CompletionStatus =
    completedUAs === 0 ? 'not_started' :
    completedUAs >= totalUAs ? 'completed' :
    'in_progress';

  return {
    formation: {
      id: formation.id,
      title: formation.title,
      description: formation.description,
      thumbnailUrl: formation.thumbnailUrl,
      pathwayMode: formation.pathwayMode,
      videoCompletionThreshold: formation.videoCompletionThreshold,
    },
    enrollment: {
      id: enrollment.id,
      startDate: enrollment.startDate.toISOString(),
      endDate: enrollment.endDate.toISOString(),
    },
    progress: {
      status: globalStatus,
      progressPercent: globalProgressPercent,
      timeSpentSeconds: totalTimeSpent,
      completedUAs,
      totalUAs,
    },
    continueUaId: firstIncompleteUaId,
    modules,
  };
}
