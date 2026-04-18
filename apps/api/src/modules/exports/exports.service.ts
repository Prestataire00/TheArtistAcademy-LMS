import { stringify } from 'csv-stringify/sync';
import { prisma } from '../../config/database';

interface PeriodFilter {
  formationId?: string;
  from?: Date;
  to?: Date;
}

function parsePeriod(formationId?: string, from?: string, to?: string): PeriodFilter {
  return {
    formationId: formationId || undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

function statusLabel(done: number, total: number): string {
  if (total === 0) return 'Non demarre';
  if (done >= total) return 'Termine';
  if (done === 0) return 'Non demarre';
  return 'En cours';
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 60) return '< 1 min';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

/**
 * Export CSV apprenants avec progression, temps, quiz, dernière activité.
 */
export async function exportLearners(formationId?: string, from?: string, to?: string) {
  const f = parsePeriod(formationId, from, to);
  const where: any = {};
  if (f.formationId) where.formationId = f.formationId;

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      user: { select: { fullName: true, email: true } },
      formation: { select: { title: true } },
      uaProgresses: true,
      quizAttempts: { select: { scorePercent: true, submittedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Nombre d'UAs publiées par formation (pour dénominateur)
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

  const rows = enrollments.map((e) => {
    const uaIds = uasByFormation.get(e.formationId);
    const totalUAs = uaIds?.size ?? 0;
    const progs = e.uaProgresses.filter((p) => !uaIds || uaIds.has(p.uaId));
    const done = progs.filter((p) => p.status === 'completed').length;
    const time = progs.reduce((s, p) => s + p.timeSpentSeconds, 0);

    // Filtre période sur activité
    const inPeriod = (d: Date) => {
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      return true;
    };
    const attempts = e.quizAttempts.filter((a) => inPeriod(a.submittedAt));
    const scores = attempts.map((a) => a.scorePercent).filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const lastActTs = progs.length > 0 ? Math.max(...progs.map((p) => p.updatedAt.getTime())) : 0;
    const lastActDate = lastActTs > 0 ? new Date(lastActTs) : null;
    const lastActFiltered = lastActDate && inPeriod(lastActDate) ? lastActDate.toISOString() : '';

    return {
      Nom: e.user.fullName,
      Email: e.user.email,
      Formation: e.formation.title,
      Statut: statusLabel(done, totalUAs),
      'Progression (%)': totalUAs > 0 ? Math.round((done / totalUAs) * 100) : 0,
      'Temps passe': formatDuration(time),
      'Nb tentatives quiz': attempts.length,
      'Score moyen (%)': avgScore !== null ? Math.round(avgScore * 10) / 10 : '',
      'Derniere activite': lastActFiltered,
    };
  });

  return stringify(rows, { header: true, bom: true });
}

/**
 * Export CSV agrégats par module/UA : nb apprenants, taux complétion, temps moyen, score moyen.
 */
export async function exportModules(formationId?: string) {
  const where = formationId ? { formationId } : {};
  const modules = await prisma.module.findMany({
    where,
    include: {
      formation: { select: { id: true, title: true } },
      uas: {
        orderBy: { position: 'asc' },
        include: {
          uaProgresses: true,
          quiz: { select: { attempts: { select: { scorePercent: true } } } },
        },
      },
    },
    orderBy: [{ formationId: 'asc' }, { position: 'asc' }],
  });

  // Nb enrollments par formation (dénominateur global du module)
  const formationIds = [...new Set(modules.map((m) => m.formation.id))];
  const enrollmentCounts = await prisma.enrollment.groupBy({
    by: ['formationId'],
    where: { formationId: { in: formationIds } },
    _count: { _all: true },
  });
  const enrollmentsByFormation = new Map(enrollmentCounts.map((e) => [e.formationId, e._count._all]));

  const rows: Record<string, unknown>[] = [];

  for (const m of modules) {
    // Agrégat par module
    const moduleProgs = m.uas.flatMap((ua) => ua.uaProgresses);
    const moduleLearners = new Set(moduleProgs.map((p) => p.enrollmentId)).size;
    const moduleDone = new Set(moduleProgs.filter((p) => p.status === 'completed').map((p) => p.enrollmentId)).size;
    const totalEnr = enrollmentsByFormation.get(m.formation.id) ?? 0;
    const moduleTime = moduleProgs.reduce((s, p) => s + p.timeSpentSeconds, 0);
    const moduleAvgTime = moduleLearners > 0 ? Math.round(moduleTime / moduleLearners) : 0;
    const moduleScores = m.uas.flatMap((ua) => ua.quiz?.attempts.map((a) => a.scorePercent).filter((s): s is number => s !== null) ?? []);
    const moduleAvgScore = moduleScores.length > 0 ? moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length : null;

    rows.push({
      Formation: m.formation.title,
      Niveau: 'Module',
      Titre: m.title,
      'Position': m.position + 1,
      'Nb apprenants': moduleLearners,
      'Taux completion (%)': totalEnr > 0 ? Math.round((moduleDone / totalEnr) * 100) : 0,
      'Temps moyen': formatDuration(moduleAvgTime),
      'Score moyen (%)': moduleAvgScore !== null ? Math.round(moduleAvgScore * 10) / 10 : '',
    });

    // Agrégat par UA
    for (const ua of m.uas) {
      const learners = new Set(ua.uaProgresses.map((p) => p.enrollmentId)).size;
      const doneUA = ua.uaProgresses.filter((p) => p.status === 'completed').length;
      const time = ua.uaProgresses.reduce((s, p) => s + p.timeSpentSeconds, 0);
      const avgTime = learners > 0 ? Math.round(time / learners) : 0;
      const uaScores = ua.quiz?.attempts.map((a) => a.scorePercent).filter((s): s is number => s !== null) ?? [];
      const uaAvgScore = uaScores.length > 0 ? uaScores.reduce((a, b) => a + b, 0) / uaScores.length : null;

      rows.push({
        Formation: m.formation.title,
        Niveau: `UA (${ua.type})`,
        Titre: `  ${m.title} › ${ua.title}`,
        'Position': ua.position + 1,
        'Nb apprenants': learners,
        'Taux completion (%)': totalEnr > 0 ? Math.round((doneUA / totalEnr) * 100) : 0,
        'Temps moyen': formatDuration(avgTime),
        'Score moyen (%)': uaAvgScore !== null ? Math.round(uaAvgScore * 10) / 10 : '',
      });
    }
  }

  return stringify(rows, { header: true, bom: true });
}

/**
 * Export CSV logs evenements horodatés, filtrables par période.
 */
export async function exportLogs(from?: string, to?: string) {
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const logs = await prisma.eventLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000,
    include: { user: { select: { email: true, fullName: true } } },
  });

  const rows = logs.map((l) => ({
    Date: l.createdAt.toISOString(),
    Categorie: l.category,
    Action: l.action,
    Utilisateur: l.user?.fullName ?? '',
    Email: l.user?.email ?? '',
    'Type entite': l.entityType ?? '',
    'ID entite': l.entityId ?? '',
    IP: l.ipAddress ?? '',
    Payload: l.payload ? JSON.stringify(l.payload) : '',
  }));

  return stringify(rows, { header: true, bom: true });
}

/**
 * Export CSV journal relances.
 */
export async function exportReminders() {
  const logs = await prisma.reminderLog.findMany({
    orderBy: { sentAt: 'desc' },
    include: {
      user: { select: { fullName: true, email: true } },
      enrollment: { select: { formation: { select: { title: true } } } },
      rule: { select: { name: true, delayDays: true, templateName: true } },
    },
  });

  const rows = logs.map((l) => ({
    Date: l.sentAt.toISOString(),
    Formation: l.enrollment.formation.title,
    Regle: `${l.rule.name} (${l.rule.delayDays}j)`,
    Destinataire: l.user.fullName,
    Email: l.user.email,
    Template: `${l.rule.templateName}${l.templateVersion ? ` v${l.templateVersion}` : ''}`,
    Statut: l.status,
    Erreur: l.errorMessage ?? '',
  }));

  return stringify(rows, { header: true, bom: true });
}
