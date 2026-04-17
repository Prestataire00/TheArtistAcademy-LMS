import { prisma } from '../../config/database';

/**
 * Liste des utilisateurs avec le role trainer.
 */
export async function listTrainers() {
  return prisma.user.findMany({
    where: { role: 'trainer', isActive: true },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  });
}

/**
 * Stats globales du dashboard admin.
 */
export async function getDashboardStats() {
  const [formationsCount, activeEnrollments, allEnrollments, publishedUAs] = await Promise.all([
    prisma.formation.count(),
    prisma.enrollment.count({ where: { status: 'active' } }),
    prisma.enrollment.findMany({
      include: { uaProgresses: true, formation: { select: { title: true } } },
    }),
    prisma.uA.findMany({
      where: { isPublished: true },
      select: { id: true, module: { select: { formationId: true } } },
    }),
  ]);

  // UAs publiees par formation
  const uasByFormation = new Map<string, Set<string>>();
  for (const ua of publishedUAs) {
    const fid = ua.module.formationId;
    if (!uasByFormation.has(fid)) uasByFormation.set(fid, new Set());
    uasByFormation.get(fid)!.add(ua.id);
  }

  // Calcul completion globale
  let totalCompleted = 0;
  const bySession = new Map<string, { title: string; learners: number; completed: number; totalProgress: number }>();

  for (const enr of allEnrollments) {
    const fid = enr.formationId;
    const uaIds = uasByFormation.get(fid);
    const totalUAs = uaIds?.size ?? 0;
    const done = totalUAs > 0
      ? enr.uaProgresses.filter((p) => p.status === 'completed' && uaIds!.has(p.uaId)).length
      : 0;
    const isCompleted = totalUAs > 0 && done >= totalUAs;
    const progress = totalUAs > 0 ? (done / totalUAs) * 100 : 0;

    if (isCompleted) totalCompleted++;

    if (!bySession.has(fid)) {
      bySession.set(fid, { title: enr.formation.title, learners: 0, completed: 0, totalProgress: 0 });
    }
    const s = bySession.get(fid)!;
    s.learners++;
    if (isCompleted) s.completed++;
    s.totalProgress += progress;
  }

  const totalEnrollments = allEnrollments.length;
  const globalCompletionRate = totalEnrollments > 0 ? Math.round((totalCompleted / totalEnrollments) * 100) : 0;

  const sessions = Array.from(bySession.entries()).map(([formationId, s]) => ({
    formationId,
    title: s.title,
    learnersCount: s.learners,
    completedCount: s.completed,
    completionRate: s.learners > 0 ? Math.round((s.completed / s.learners) * 100) : 0,
    avgProgress: s.learners > 0 ? Math.round(s.totalProgress / s.learners) : 0,
  }));

  return {
    formationsCount,
    activeLearnersCount: activeEnrollments,
    globalCompletionRate,
    sessions,
  };
}

/**
 * Liste des apprenants avec progression, filtrable par formation.
 */
export async function getApprenants(formationId?: string) {
  const where = formationId ? { formationId } : {};

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, email: true, lastSeenAt: true } },
      formation: { select: { id: true, title: true } },
      uaProgresses: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // UAs publiees par formation
  const formationIds = [...new Set(enrollments.map((e) => e.formationId))];
  const publishedUAs = await prisma.uA.findMany({
    where: { module: { formationId: { in: formationIds } }, isPublished: true },
    select: { id: true, module: { select: { formationId: true } } },
  });
  const uasByFormation = new Map<string, Set<string>>();
  for (const ua of publishedUAs) {
    const fid = ua.module.formationId;
    if (!uasByFormation.has(fid)) uasByFormation.set(fid, new Set());
    uasByFormation.get(fid)!.add(ua.id);
  }

  // Formations pour le filtre
  const formations = await prisma.formation.findMany({
    where: { enrollments: { some: {} } },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });

  return {
    formations,
    apprenants: enrollments.map((e) => {
      const uaIds = uasByFormation.get(e.formationId);
      const totalUAs = uaIds?.size ?? 0;
      const done = totalUAs > 0
        ? e.uaProgresses.filter((p) => p.status === 'completed' && uaIds!.has(p.uaId)).length
        : 0;
      const progress = totalUAs > 0 ? Math.round((done / totalUAs) * 100) : 0;
      const status = done === 0 ? 'not_started' : (totalUAs > 0 && done >= totalUAs) ? 'completed' : 'in_progress';
      const lastActivity = e.uaProgresses.length > 0
        ? new Date(Math.max(...e.uaProgresses.map((p) => p.updatedAt.getTime()))).toISOString()
        : null;

      return {
        userId: e.user.id,
        fullName: e.user.fullName,
        email: e.user.email,
        formationId: e.formation.id,
        formationTitle: e.formation.title,
        status,
        progressPercent: progress,
        lastActivity,
      };
    }),
  };
}

/**
 * Logs SSO (derniers 100).
 */
export async function getSsoLogs() {
  const logs = await prisma.eventLog.findMany({
    where: { category: 'sso' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true, fullName: true } } },
  });

  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    email: l.user?.email ?? (l.payload as any)?.email ?? 'inconnu',
    success: l.action === 'sso_success',
    error: l.action !== 'sso_success' ? ((l.payload as any)?.error ?? l.action) : null,
    ipAddress: l.ipAddress,
    timestamp: l.createdAt.toISOString(),
  }));
}

/**
 * Journal des relances email.
 */
export async function getReminderLogs() {
  const logs = await prisma.reminderLog.findMany({
    orderBy: { sentAt: 'desc' },
    take: 200,
    include: {
      user: { select: { fullName: true, email: true } },
      rule: { select: { delayDays: true, formation: { select: { title: true } } } },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    ruleName: l.rule.formation?.title
      ? `${l.rule.formation.title} — ${l.rule.delayDays}j`
      : `Global — ${l.rule.delayDays}j`,
    recipientName: l.user.fullName,
    recipientEmail: l.user.email,
    templateId: l.templateId,
    status: l.status,
    errorMessage: l.errorMessage,
    sentAt: l.sentAt.toISOString(),
  }));
}
