import { stringify } from 'csv-stringify/sync';
import { prisma } from '../../config/database';

/**
 * Export CSV apprenants par session.
 */
export async function exportLearners(formationId?: string) {
  const where = formationId ? { formationId } : {};
  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      user: { select: { fullName: true, email: true } },
      formation: { select: { title: true } },
      uaProgresses: true,
    },
  });

  const rows = enrollments.map((e) => {
    const done = e.uaProgresses.filter((p) => p.status === 'completed').length;
    const total = e.uaProgresses.length;
    const time = e.uaProgresses.reduce((s, p) => s + p.timeSpentSeconds, 0);
    const lastAct = e.uaProgresses.length > 0
      ? new Date(Math.max(...e.uaProgresses.map((p) => p.updatedAt.getTime()))).toISOString()
      : '';
    return {
      Nom: e.user.fullName,
      Email: e.user.email,
      Formation: e.formation.title,
      'Progression (%)': total > 0 ? Math.round((done / total) * 100) : 0,
      'UAs terminees': done,
      'Temps (secondes)': time,
      'Derniere activite': lastAct,
      Statut: done === 0 ? 'Non demarre' : done >= total ? 'Termine' : 'En cours',
    };
  });

  return stringify(rows, { header: true, bom: true });
}

/**
 * Export CSV modules/UA par session.
 */
export async function exportModules(formationId?: string) {
  const where = formationId ? { formationId } : {};
  const modules = await prisma.module.findMany({
    where,
    include: {
      formation: { select: { title: true } },
      uas: { orderBy: { position: 'asc' } },
    },
    orderBy: [{ formationId: 'asc' }, { position: 'asc' }],
  });

  const rows = modules.flatMap((m) =>
    m.uas.map((ua) => ({
      Formation: m.formation.title,
      Module: m.title,
      'Position module': m.position + 1,
      UA: ua.title,
      Type: ua.type,
      'Position UA': ua.position + 1,
      Publiee: ua.isPublished ? 'Oui' : 'Non',
    })),
  );

  return stringify(rows, { header: true, bom: true });
}

/**
 * Export CSV logs evenements.
 */
export async function exportLogs(formationId?: string) {
  const where = formationId ? { enrollment: { formationId } } : {};
  const logs = await prisma.eventLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: { user: { select: { email: true } } },
  });

  const rows = logs.map((l) => ({
    Date: l.createdAt.toISOString(),
    Categorie: l.category,
    Action: l.action,
    Email: l.user?.email ?? '',
    'Type entite': l.entityType ?? '',
    'ID entite': l.entityId ?? '',
    IP: l.ipAddress ?? '',
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
      rule: { select: { delayDays: true, formation: { select: { title: true } } } },
    },
  });

  const rows = logs.map((l) => ({
    Date: l.sentAt.toISOString(),
    Regle: l.rule.formation?.title ? `${l.rule.formation.title} — ${l.rule.delayDays}j` : `Global — ${l.rule.delayDays}j`,
    Destinataire: l.user.fullName,
    Email: l.user.email,
    Template: l.templateId,
    Statut: l.status,
    Erreur: l.errorMessage ?? '',
  }));

  return stringify(rows, { header: true, bom: true });
}
