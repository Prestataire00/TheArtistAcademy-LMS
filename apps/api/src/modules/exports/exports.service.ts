import { stringify } from 'csv-stringify/sync';
import type { CompletionStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { formatDate, formatDuration, formatPercent, percentInt } from './exports.formatters';
import { computeModuleProgress } from '../../shared/moduleProgress';

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
    const lastActFiltered = lastActDate && inPeriod(lastActDate) ? lastActDate : null;

    return {
      Nom: e.user.fullName,
      Email: e.user.email,
      Formation: e.formation.title,
      Statut: statusLabel(done, totalUAs),
      'Progression (%)': formatPercent(totalUAs > 0 ? done / totalUAs : null),
      'Temps passe': formatDuration(time),
      'Nb tentatives quiz': attempts.length,
      'Score moyen (%)': formatPercent(avgScore !== null ? avgScore / 100 : null),
      'Derniere activite': formatDate(lastActFiltered),
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
      'Taux completion (%)': formatPercent(totalEnr > 0 ? moduleDone / totalEnr : null),
      'Temps moyen': formatDuration(moduleAvgTime),
      'Score moyen (%)': formatPercent(moduleAvgScore !== null ? moduleAvgScore / 100 : null),
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
        'Taux completion (%)': formatPercent(totalEnr > 0 ? doneUA / totalEnr : null),
        'Temps moyen': formatDuration(avgTime),
        'Score moyen (%)': formatPercent(uaAvgScore !== null ? uaAvgScore / 100 : null),
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
    Date: formatDate(l.createdAt),
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
    Date: formatDate(l.sentAt),
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

// ─── Helpers internes pour les nouveaux exports (financeur + progression-modules) ──

function moduleStatusLabelFr(status: CompletionStatus): string {
  if (status === 'not_started') return 'Non démarré';
  if (status === 'completed') return 'Terminé';
  return 'En cours';
}

/** Libellé FR du statut UA (libellés identiques à ceux du module). */
function uaStatusLabelFr(status: CompletionStatus): string {
  return moduleStatusLabelFr(status);
}

/** Libellé FR du type UA pour les exports. */
function uaTypeLabelFr(type: 'video' | 'quiz' | 'resource'): string {
  if (type === 'video') return 'Video';
  if (type === 'quiz') return 'Quiz';
  return 'Ressource';
}

function minDateOrNull(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => !!d);
  if (valid.length === 0) return null;
  return new Date(Math.min(...valid.map((d) => d.getTime())));
}

function maxDateOrNull(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => !!d);
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

/** Sépare "Eva Randrianasolo" en { firstName: "Eva", lastName: "Randrianasolo" }. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Progression d'une UA pour un apprenant, sous forme décimale 0-1 prête pour `formatPercent`.
 * - Vidéo : `videoPercentWatched` (stocké en 0-100) ÷ 100.
 * - Quiz / ressource : 1 si `completed`, 0 sinon (pas de notion de % partiel).
 */
function uaProgressDecimal(
  uaType: 'video' | 'quiz' | 'resource',
  p: { status: string; videoPercentWatched: number },
): number {
  if (uaType === 'video') return (p.videoPercentWatched ?? 0) / 100;
  return p.status === 'completed' ? 1 : 0;
}

/**
 * Export CSV Financeur (CPF/OPCO) — une ligne par UA par apprenant.
 *
 * Filtres optionnels (tous combinables) :
 *  - `formationId` : filtre sur `Enrollment.formationId`
 *  - `sessionId`   : filtre sur `Enrollment.dendreoSessionId`
 *  - `dateFrom` / `dateTo` : bornes sur `UAProgress.firstAccessedAt` (= Date de connexion)
 *
 * Inclusions :
 *  - `Enrollment.status = 'active'` (consigne : "enrollment actif")
 *  - `UAProgress.status != 'not_started'` (pertinence financeur : complétion / progression réelle)
 */
export async function exportFinancier(opts: {
  formationId?: string;
  sessionId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const firstAccessedAt: { gte?: Date; lte?: Date } = {};
  if (opts.dateFrom) firstAccessedAt.gte = new Date(opts.dateFrom);
  if (opts.dateTo) firstAccessedAt.lte = new Date(opts.dateTo);

  const progresses = await prisma.uAProgress.findMany({
    where: {
      status: { not: 'not_started' },
      enrollment: {
        status: 'active',
        ...(opts.formationId ? { formationId: opts.formationId } : {}),
        ...(opts.sessionId ? { dendreoSessionId: opts.sessionId } : {}),
      },
      ...(opts.dateFrom || opts.dateTo ? { firstAccessedAt } : {}),
    },
    include: {
      enrollment: {
        include: {
          user: { select: { fullName: true, email: true } },
          formation: { select: { title: true } },
        },
      },
      ua: {
        include: {
          module: { select: { title: true, position: true } },
        },
      },
    },
  });

  // Tri stable : apprenant (nom complet) → formation → module.position → ua.position
  progresses.sort((a, b) => {
    const an = a.enrollment.user.fullName.localeCompare(b.enrollment.user.fullName, 'fr');
    if (an !== 0) return an;
    const af = a.enrollment.formation.title.localeCompare(b.enrollment.formation.title, 'fr');
    if (af !== 0) return af;
    if (a.ua.module.position !== b.ua.module.position) return a.ua.module.position - b.ua.module.position;
    return a.ua.position - b.ua.position;
  });

  const rows = progresses.map((p) => {
    const { firstName, lastName } = splitFullName(p.enrollment.user.fullName);
    return {
      'Prenom': firstName,
      'Nom': lastName,
      'Courriel': p.enrollment.user.email,
      'Adresse IP': p.ipAddress ?? '-',
      'Pays': p.country ?? '-',
      'Nom de formation': p.enrollment.formation.title,
      'Nom du module': p.ua.module.title,
      "Unite d'apprentissage": p.ua.title,
      'Date de connexion': formatDate(p.firstAccessedAt),
      'Date de sortie': formatDate(p.completedAt),
      'Temps ecoule': formatDuration(p.timeSpentSeconds),
      // Pattern cible : header `(%)` + valeur entier brut (cf. percentInt JSDoc)
      'Progres (%)': percentInt(uaProgressDecimal(p.ua.type, p)),
    };
  });

  return stringify(rows, { header: true, bom: true });
}

/**
 * Export CSV Progression détaillée par apprenant — une ligne par UA par apprenant.
 *
 * Chaque ligne UA répète les infos de son module parent (statut module, %, temps),
 * de sorte qu'une analyse Excel/PivotTable puisse remonter au niveau module sans
 * jointure manuelle. Tri : apprenant → formation → position module → position UA.
 *
 * Filtres optionnels :
 *  - `formationId` : `Enrollment.formationId`
 *  - `sessionId`   : `Enrollment.dendreoSessionId`
 *
 * Inclusions :
 *  - `Enrollment.status = 'active'`
 *  - Toutes les UAs publiées des modules (y compris non démarrées)
 *  - PAS de filtrage sur statut UA (contrairement au Financeur qui exclut not_started)
 */
export async function exportProgressionDetaillee(opts: {
  formationId?: string;
  sessionId?: string;
}) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: 'active',
      ...(opts.formationId ? { formationId: opts.formationId } : {}),
      ...(opts.sessionId ? { dendreoSessionId: opts.sessionId } : {}),
    },
    include: {
      user: { select: { fullName: true, email: true } },
      formation: {
        select: {
          id: true,
          title: true,
          modules: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              title: true,
              position: true,
              uas: {
                where: { isPublished: true },
                orderBy: { position: 'asc' },
                // type + videoContent.durationSeconds requis pour la pondération par durée (PRD §3.4)
                select: {
                  id: true,
                  title: true,
                  type: true,
                  position: true,
                  videoContent: { select: { durationSeconds: true } },
                },
              },
            },
          },
        },
      },
      uaProgresses: {
        select: {
          uaId: true,
          status: true,
          videoPercentWatched: true,
          timeSpentSeconds: true,
          firstAccessedAt: true,
          completedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  // Tri stable des enrollments : apprenant (locale fr) → formation
  enrollments.sort((a, b) => {
    const an = a.user.fullName.localeCompare(b.user.fullName, 'fr');
    if (an !== 0) return an;
    return a.formation.title.localeCompare(b.formation.title, 'fr');
  });

  const rows: Record<string, unknown>[] = [];

  for (const e of enrollments) {
    const { firstName, lastName } = splitFullName(e.user.fullName);
    const progressByUaId = new Map(e.uaProgresses.map((p) => [p.uaId, p]));

    for (const mod of e.formation.modules) {
      // Agrégats module — calculés une fois, répétés sur chaque ligne UA du module
      const uaInputs = mod.uas.map((ua) => ({
        status: (progressByUaId.get(ua.id)?.status ?? 'not_started') as CompletionStatus,
        type: ua.type,
        videoDurationSeconds: ua.videoContent?.durationSeconds,
      }));
      const moduleAgg = computeModuleProgress(uaInputs);
      const moduleTimeSpent = mod.uas.reduce((s, ua) => s + (progressByUaId.get(ua.id)?.timeSpentSeconds ?? 0), 0);

      for (const ua of mod.uas) {
        const p = progressByUaId.get(ua.id);
        const uaStatus: CompletionStatus = p?.status ?? 'not_started';
        // Décimal 0..1 prêt pour formatPercent — vidéo: videoPercentWatched/100, autre: 1 ou 0
        const uaProgress = ua.type === 'video'
          ? (p?.videoPercentWatched ?? 0) / 100
          : (uaStatus === 'completed' ? 1 : 0);

        rows.push({
          'Prenom': firstName,
          'Nom': lastName,
          'Courriel': e.user.email,
          'Nom de formation': e.formation.title,
          'Nom du module': mod.title,
          'Position du module': mod.position + 1,
          'Statut module': moduleStatusLabelFr(moduleAgg.status),
          // Pattern cible : header `(%)` + valeur entier brut (cf. percentInt JSDoc)
          'Progression module (%)': percentInt(moduleAgg.progressPercent / 100),
          'Temps passe sur le module': formatDuration(moduleTimeSpent),
          "Unite d'apprentissage": ua.title,
          "Position de l'UA": ua.position + 1,
          'Type UA': uaTypeLabelFr(ua.type),
          'Statut UA': uaStatusLabelFr(uaStatus),
          'Progression UA (%)': percentInt(uaProgress),
          "Temps passe sur l'UA": formatDuration(p?.timeSpentSeconds ?? 0),
          'Date 1ere activite UA': formatDate(p?.firstAccessedAt ?? null),
          'Date derniere activite UA': formatDate(p?.updatedAt ?? null),
          'Date completion UA': formatDate(p?.completedAt ?? null),
        });
      }
    }
  }

  return stringify(rows, { header: true, bom: true });
}
