import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';

/**
 * Liste les formations avec enrollments (sessions) visibles par le formateur.
 * V1 : un formateur voit toutes les formations ayant au moins un enrollment.
 */
export async function listSessions() {
  const formations = await prisma.formation.findMany({
    where: { enrollments: { some: {} } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { modules: true } },
      modules: {
        where: { isPublished: true },
        include: { uas: { where: { isPublished: true }, select: { id: true } } },
      },
      enrollments: {
        include: {
          user: { select: { id: true, fullName: true } },
          formationProgress: true,
          uaProgresses: true,
        },
      },
    },
  });

  return formations.map((f) => {
    const total = f.enrollments.length;
    const totalUAs = f.modules.reduce((sum, m) => sum + m.uas.length, 0);
    const completed = f.enrollments.filter((e) => {
      const done = e.uaProgresses.filter((p) => p.status === 'completed').length;
      return totalUAs > 0 && done >= totalUAs;
    }).length;

    // Progression moyenne = moyenne des (UAs completees / total UAs) par apprenant
    const progressValues = f.enrollments.map((e) => {
      const done = e.uaProgresses.filter((p) => p.status === 'completed').length;
      return totalUAs > 0 ? (done / totalUAs) * 100 : 0;
    });
    const avgProgress = total > 0 ? Math.round(progressValues.reduce((a, b) => a + b, 0) / total) : 0;

    return {
      formationId: f.id,
      title: f.title,
      modulesCount: f._count.modules,
      learnersCount: total,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      completedCount: completed,
      avgProgressPercent: avgProgress,
    };
  });
}

/**
 * Liste les apprenants d'une formation avec leur progression.
 */
export async function listApprenants(formationId: string) {
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) throw new NotFoundError('Formation');

  const enrollments = await prisma.enrollment.findMany({
    where: { formationId },
    include: {
      user: { select: { id: true, fullName: true, email: true, lastSeenAt: true } },
      formationProgress: true,
      uaProgresses: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // IDs des UAs publiees de la formation
  const publishedUAs = await prisma.uA.findMany({
    where: { module: { formationId }, isPublished: true },
    select: { id: true },
  });
  const publishedUAIds = new Set(publishedUAs.map((u) => u.id));
  const totalUAs = publishedUAIds.size;

  return {
    formationTitle: formation.title,
    formationId: formation.id,
    apprenants: enrollments.map((e) => {
      // Ne compter que les progresses pour des UAs publiees
      const completedUAs = e.uaProgresses.filter((p) => p.status === 'completed' && publishedUAIds.has(p.uaId)).length;
      const totalTime = e.uaProgresses.reduce((sum, p) => sum + p.timeSpentSeconds, 0);

      // Derniere activite = max de toutes les updatedAt des UA progresses
      const lastActivity = e.uaProgresses.length > 0
        ? new Date(Math.max(...e.uaProgresses.map((p) => p.updatedAt.getTime())))
        : null;

      const progressPercent = totalUAs > 0 ? Math.round((completedUAs / totalUAs) * 100) : 0;
      const status = completedUAs === 0 ? 'not_started' : completedUAs >= totalUAs ? 'completed' : 'in_progress';

      return {
        userId: e.user.id,
        fullName: e.user.fullName,
        email: e.user.email,
        enrollmentId: e.id,
        status,
        progressPercent,
        timeSpentSeconds: totalTime,
        completedUAs,
        totalUAs,
        lastActivity: lastActivity?.toISOString() ?? null,
        lastSeenAt: e.user.lastSeenAt?.toISOString() ?? null,
      };
    }),
  };
}

/**
 * Detail individuel d'un apprenant : progression par module/UA, quiz.
 */
export async function getApprenantDetail(formationId: string, userId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { formationId, userId },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      formationProgress: true,
    },
  });
  if (!enrollment) throw new NotFoundError('Inscription');

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

  // Charger progressions
  const uaProgresses = await prisma.uAProgress.findMany({
    where: { enrollmentId: enrollment.id },
  });
  const progressMap = new Map(uaProgresses.map((p) => [p.uaId, p]));

  // Charger quiz attempts
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { enrollmentId: enrollment.id },
    include: {
      quiz: { select: { uaId: true, title: true } },
      answers: {
        include: {
          question: { select: { questionText: true, type: true } },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });

  const modules = formation.modules.map((mod) => {
    const uas = mod.uas.map((ua) => {
      const prog = progressMap.get(ua.id);
      return {
        id: ua.id,
        title: ua.title,
        type: ua.type,
        status: prog?.status ?? 'not_started',
        timeSpentSeconds: prog?.timeSpentSeconds ?? 0,
        videoPercentWatched: prog?.videoPercentWatched ?? 0,
        completedAt: prog?.completedAt?.toISOString() ?? null,
      };
    });

    const completed = uas.filter((u) => u.status === 'completed').length;
    return {
      id: mod.id,
      title: mod.title,
      position: mod.position,
      progressPercent: uas.length > 0 ? Math.round((completed / uas.length) * 100) : 0,
      status: completed === 0 ? 'not_started' : completed >= uas.length ? 'completed' : 'in_progress',
      uas,
    };
  });

  // Formatter les quiz attempts
  const quizHistory = quizAttempts.map((att) => {
    const shortAnswers = att.answers
      .filter((a) => a.question.type === 'short' && a.shortAnswerText)
      .map((a) => ({
        question: a.question.questionText,
        answer: a.shortAnswerText!,
      }));

    return {
      attemptId: att.id,
      quizTitle: att.quiz.title,
      uaId: att.quiz.uaId,
      attemptNumber: att.attemptNumber,
      scorePercent: att.scorePercent,
      submittedAt: att.submittedAt.toISOString(),
      shortAnswers,
    };
  });

  const totalTime = uaProgresses.reduce((sum, p) => sum + p.timeSpentSeconds, 0);

  return {
    user: enrollment.user,
    enrollmentId: enrollment.id,
    formationTitle: formation.title,
    status: (() => {
      const totalDone = uaProgresses.filter((p) => p.status === 'completed').length;
      const totalAll = formation.modules.reduce((s, m) => s + m.uas.length, 0);
      if (totalDone === 0) return 'not_started';
      if (totalAll > 0 && totalDone >= totalAll) return 'completed';
      return 'in_progress';
    })(),
    timeSpentSeconds: totalTime,
    modules,
    quizHistory,
  };
}

/**
 * Statistiques agregees d'une formation/session.
 */
export async function getSessionStats(formationId: string) {
  const formation = await prisma.formation.findUnique({ where: { id: formationId } });
  if (!formation) throw new NotFoundError('Formation');

  const enrollments = await prisma.enrollment.findMany({
    where: { formationId },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      formationProgress: true,
      uaProgresses: true,
    },
  });

  const publishedUAs = await prisma.uA.findMany({
    where: { module: { formationId }, isPublished: true },
    select: { id: true },
  });
  const publishedUAIds = new Set(publishedUAs.map((u) => u.id));
  const totalUAs = publishedUAIds.size;

  // Quiz stats
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { quiz: { ua: { module: { formationId } } } },
    select: { scorePercent: true },
  });
  const scoredAttempts = quizAttempts.filter((a) => a.scorePercent !== null);
  const avgScore = scoredAttempts.length > 0
    ? Math.round(scoredAttempts.reduce((sum, a) => sum + a.scorePercent!, 0) / scoredAttempts.length)
    : null;

  const total = enrollments.length;

  const enriched = enrollments.map((e) => {
    const done = e.uaProgresses.filter((p) => p.status === 'completed' && publishedUAIds.has(p.uaId)).length;
    const progress = totalUAs > 0 ? (done / totalUAs) * 100 : 0;
    const isCompleted = totalUAs > 0 && done >= totalUAs;
    const time = e.uaProgresses.reduce((sum, p) => sum + p.timeSpentSeconds, 0);
    return { ...e, done, progress, isCompleted, time };
  });

  const completed = enriched.filter((e) => e.isCompleted).length;
  const avgProgress = total > 0 ? Math.round(enriched.reduce((a, e) => a + e.progress, 0) / total) : 0;
  const avgTime = total > 0 ? Math.round(enriched.reduce((a, e) => a + e.time, 0) / total) : 0;

  // Apprenants non termines
  const nonCompleted = enriched
    .filter((e) => !e.isCompleted)
    .map((e) => {
      const done = e.uaProgresses.filter((p) => p.status === 'completed').length;
      const lastAct = e.uaProgresses.length > 0
        ? new Date(Math.max(...e.uaProgresses.map((p) => p.updatedAt.getTime())))
        : null;
      return {
        userId: e.user.id,
        fullName: e.user.fullName,
        email: e.user.email,
        progressPercent: totalUAs > 0 ? Math.round((done / totalUAs) * 100) : 0,
        lastActivity: lastAct?.toISOString() ?? null,
      };
    });

  return {
    formationTitle: formation.title,
    learnersCount: total,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedCount: completed,
    avgProgressPercent: avgProgress,
    avgTimeSpentSeconds: avgTime,
    avgScorePercent: avgScore,
    nonCompleted,
  };
}
