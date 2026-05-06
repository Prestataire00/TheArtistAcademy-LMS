import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { logEvent } from '../../shared/eventLog.service';
import { sendHtmlEmail } from '../../shared/email.service';
import { NotFoundError, BadRequestError } from '../../shared/errors';

const BRAND_COLOR = '#B5294E';
const DEFAULT_TEMPLATE_NAME = 'relance_modules_bloques';

interface EnrollmentWithContext {
  id: string;
  userId: string;
  formationId: string;
  user: { fullName: string; email: string };
  formation: { title: string };
  stalledModules: { title: string }[];
}

// ─── Templates : CRUD + versioning ───────────────────────────────────────────

export async function listTemplates() {
  // Retourne la version active la plus récente de chaque template
  const templates = await prisma.reminderTemplate.findMany({
    orderBy: [{ name: 'asc' }, { version: 'desc' }],
  });

  // Groupe par name, ne garde que la version la plus récente
  const latestByName = new Map<string, typeof templates[number]>();
  for (const t of templates) {
    if (!latestByName.has(t.name)) latestByName.set(t.name, t);
  }
  return Array.from(latestByName.values());
}

export async function getTemplateByName(name: string, version?: number) {
  if (version !== undefined) {
    const t = await prisma.reminderTemplate.findUnique({ where: { name_version: { name, version } } });
    if (!t) throw new NotFoundError('Template');
    return t;
  }
  const t = await prisma.reminderTemplate.findFirst({
    where: { name, isActive: true },
    orderBy: { version: 'desc' },
  });
  if (!t) throw new NotFoundError('Template');
  return t;
}

export async function createTemplate(data: { name: string; subject: string; htmlContent: string }) {
  // Vérifie qu'un template avec ce name n'existe pas déjà
  const existing = await prisma.reminderTemplate.findFirst({ where: { name: data.name } });
  if (existing) throw new BadRequestError('Un template avec ce nom existe deja');

  return prisma.reminderTemplate.create({
    data: {
      name: data.name,
      version: 1,
      subject: data.subject,
      htmlContent: data.htmlContent,
      isActive: true,
    },
  });
}

export async function updateTemplate(name: string, data: { subject: string; htmlContent: string }) {
  // Chaque modification crée une nouvelle version. Ancienne version → isActive=false.
  const latest = await prisma.reminderTemplate.findFirst({
    where: { name },
    orderBy: { version: 'desc' },
  });
  if (!latest) throw new NotFoundError('Template');

  return prisma.$transaction(async (tx) => {
    await tx.reminderTemplate.updateMany({ where: { name }, data: { isActive: false } });
    return tx.reminderTemplate.create({
      data: {
        name,
        version: latest.version + 1,
        subject: data.subject,
        htmlContent: data.htmlContent,
        isActive: true,
      },
    });
  });
}

export async function getTemplateHistory(name: string) {
  return prisma.reminderTemplate.findMany({
    where: { name },
    orderBy: { version: 'desc' },
  });
}

/**
 * Supprime toutes les versions d'un template. Refusé si une règle l'utilise encore.
 */
export async function deleteTemplate(name: string) {
  const usedBy = await prisma.reminderRule.findMany({
    where: { templateName: name },
    select: { name: true },
  });
  if (usedBy.length > 0) {
    throw new BadRequestError(
      `Template utilise par ${usedBy.length} regle(s) : ${usedBy.map((r) => r.name).join(', ')}. Modifiez ou supprimez d'abord ces regles.`,
    );
  }
  await prisma.reminderTemplate.deleteMany({ where: { name } });
}

/**
 * Duplique un template : nouveau nom `<name>_copie` (ou `_copie_2`, `_copie_3`... si conflit),
 * version remise à 1, contenu copié depuis la version active du template source.
 */
export async function duplicateTemplate(sourceName: string) {
  const source = await getTemplateByName(sourceName);

  const base = `${sourceName}_copie`;
  let newName = base;
  let suffix = 2;
  while (await prisma.reminderTemplate.findFirst({ where: { name: newName }, select: { id: true } })) {
    newName = `${base}_${suffix}`;
    suffix++;
  }

  return prisma.reminderTemplate.create({
    data: {
      name: newName,
      version: 1,
      subject: source.subject,
      htmlContent: source.htmlContent,
      isActive: true,
    },
  });
}

// ─── Rules : CRUD ────────────────────────────────────────────────────────────

export async function listRules(options: { includeArchived?: boolean } = {}) {
  const rules = await prisma.reminderRule.findMany({
    where: options.includeArchived ? undefined : { archivedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  // Enrichit avec info template
  const names = [...new Set(rules.map((r) => r.templateName))];
  const templates = await prisma.reminderTemplate.findMany({
    where: { name: { in: names }, isActive: true },
    select: { name: true, subject: true, version: true },
  });
  const byName = new Map(templates.map((t) => [t.name, t]));

  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    delayDays: r.delayDays,
    sendHour: r.sendHour,
    templateName: r.templateName,
    templateSubject: byName.get(r.templateName)?.subject ?? null,
    templateVersion: byName.get(r.templateName)?.version ?? null,
    isActive: r.isActive,
    excludeCompleted: r.excludeCompleted,
    excludeExpired: r.excludeExpired,
    excludeUnenrolled: r.excludeUnenrolled,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createRule(data: {
  name: string;
  delayDays: number;
  sendHour: number;
  templateName: string;
  isActive?: boolean;
  excludeCompleted?: boolean;
  excludeExpired?: boolean;
  excludeUnenrolled?: boolean;
}) {
  await getTemplateByName(data.templateName);
  return prisma.reminderRule.create({
    data: {
      name: data.name,
      delayDays: data.delayDays,
      sendHour: data.sendHour,
      templateName: data.templateName,
      isActive: data.isActive ?? true,
      excludeCompleted: data.excludeCompleted ?? true,
      excludeExpired: data.excludeExpired ?? true,
      excludeUnenrolled: data.excludeUnenrolled ?? true,
    },
  });
}

export async function updateRule(
  id: string,
  data: Partial<{
    name: string;
    delayDays: number;
    sendHour: number;
    templateName: string;
    isActive: boolean;
    excludeCompleted: boolean;
    excludeExpired: boolean;
    excludeUnenrolled: boolean;
  }>,
) {
  if (data.templateName) await getTemplateByName(data.templateName);
  return prisma.reminderRule.update({ where: { id }, data });
}

/**
 * Archivage "soft-delete" : la règle disparaît des listes actives mais
 * reste référencée par les logs historiques. Peut être désarchivée.
 */
export async function archiveRule(id: string) {
  return prisma.reminderRule.update({
    where: { id },
    data: { archivedAt: new Date(), isActive: false },
  });
}

export async function unarchiveRule(id: string) {
  return prisma.reminderRule.update({
    where: { id },
    data: { archivedAt: null },
  });
}

// ─── Rendu du template : remplacement des variables ──────────────────────────

function renderTemplate(
  tpl: { subject: string; htmlContent: string },
  vars: { prenom: string; nom: string; formation: string; modules_en_retard: string[]; lien_formation: string },
): { subject: string; html: string } {
  const modulesHtml = vars.modules_en_retard
    .map((m) => `<li style="margin-bottom: 4px; color: #374151;">${escapeHtml(m)}</li>`)
    .join('');

  const replacements: Record<string, string> = {
    '{{prenom}}': escapeHtml(vars.prenom),
    '{{nom}}': escapeHtml(vars.nom),
    '{{formation}}': escapeHtml(vars.formation),
    '{{modules_en_retard}}': `<ul style="font-size: 15px; padding-left: 20px; margin: 0 0 24px 0;">${modulesHtml}</ul>`,
    '{{lien_formation}}': vars.lien_formation,
  };

  const apply = (s: string) =>
    Object.entries(replacements).reduce((out, [k, v]) => out.replaceAll(k, v), s);

  return { subject: apply(tpl.subject), html: apply(tpl.htmlContent) };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Template par défaut (seed si absent) ────────────────────────────────────

const DEFAULT_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><title>Reprenez votre formation</title></head>
<body style="margin: 0; padding: 0; background-color: #f6f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f8;">
    <tr><td align="center" style="padding: 32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr><td style="padding: 28px 32px 16px 32px; border-bottom: 3px solid ${BRAND_COLOR};">
          <div style="font-size: 22px; font-weight: 700; color: ${BRAND_COLOR}; letter-spacing: 0.5px;">THE ARTIST ACADEMY</div>
        </td></tr>
        <tr><td style="padding: 32px;">
          <p style="font-size: 16px; color: #111827; margin: 0 0 16px 0;">Bonjour {{prenom}} {{nom}},</p>
          <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
            Vous n'avez pas termine les modules suivants de votre formation <strong>{{formation}}</strong> :
          </p>
          {{modules_en_retard}}
          <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 28px 0;">Prenez quelques minutes pour poursuivre votre parcours.</p>
          <p style="text-align: center; margin: 0 0 24px 0;">
            <a href="{{lien_formation}}" style="display: inline-block; padding: 13px 32px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reprendre ma formation</a>
          </p>
        </td></tr>
        <tr><td style="padding: 20px 32px; background-color: #fafafb; border-top: 1px solid #eef0f2;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">The Artist Academy — Cet email est automatique, ne pas repondre.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export async function ensureDefaultTemplateAndRule() {
  const existingTpl = await prisma.reminderTemplate.findFirst({ where: { name: DEFAULT_TEMPLATE_NAME } });
  if (!existingTpl) {
    await prisma.reminderTemplate.create({
      data: {
        name: DEFAULT_TEMPLATE_NAME,
        version: 1,
        subject: 'Reprenez votre formation : {{formation}}',
        htmlContent: DEFAULT_TEMPLATE_HTML,
        isActive: true,
      },
    });
    logger.info('Default reminder template seeded');
  }

  const existingRule = await prisma.reminderRule.findFirst({ where: { templateName: DEFAULT_TEMPLATE_NAME } });
  if (!existingRule) {
    await prisma.reminderRule.create({
      data: {
        name: 'Relance modules bloques',
        delayDays: env.REMINDER_DELAY_DAYS,
        sendHour: 9,
        templateName: DEFAULT_TEMPLATE_NAME,
        isActive: true,
      },
    });
    logger.info('Default reminder rule seeded');
  }
}

// ─── Sélection des enrollments éligibles pour une règle ──────────────────────

interface EligibilityFilters {
  delayDays: number;
  excludeCompleted: boolean;
  excludeExpired: boolean;
  excludeUnenrolled: boolean;
}

type SkipReason = 'delai_non_atteint' | 'formation_terminee' | 'acces_cloture' | 'desinscrit';

interface SkippedEnrollment {
  enrollmentId: string;
  email: string;
  formation: string;
  reason: SkipReason;
  detail?: string;
}

interface EligibilityResult {
  eligible: EnrollmentWithContext[];
  skipped: SkippedEnrollment[];
}

async function findEligibleEnrollments(filters: EligibilityFilters, ruleName: string): Promise<EligibilityResult> {
  const threshold = new Date(Date.now() - filters.delayDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Query large : on récupère toutes les inscriptions ayant au moins un module non terminé.
  // Les exclusions sont appliquées EN MÉMOIRE pour pouvoir logger chaque skip.
  const enrollments = await prisma.enrollment.findMany({
    where: {
      moduleProgresses: { some: { status: { not: 'completed' } } },
    },
    include: {
      user: { select: { fullName: true, email: true } },
      formation: { select: { title: true } },
      formationProgress: { select: { progressPercent: true } },
      moduleProgresses: {
        where: { status: { not: 'completed' } },
        include: { module: { select: { title: true } } },
      },
    },
  });

  const eligible: EnrollmentWithContext[] = [];
  const skipped: SkippedEnrollment[] = [];

  for (const e of enrollments) {
    const ctx = { enrollmentId: e.id, email: e.user.email, formation: e.formation.title, rule: ruleName };

    // 1) Désinscrit
    if (filters.excludeUnenrolled && e.status !== 'active') {
      logger.info('[reminder] SKIP desinscrit', { ...ctx, status: e.status });
      skipped.push({ enrollmentId: e.id, email: e.user.email, formation: e.formation.title, reason: 'desinscrit', detail: `status=${e.status}` });
      continue;
    }

    // 2) Accès clôturé (end_date dépassée)
    if (filters.excludeExpired && e.endDate <= now) {
      logger.info('[reminder] SKIP acces cloture', { ...ctx, endDate: e.endDate.toISOString() });
      skipped.push({ enrollmentId: e.id, email: e.user.email, formation: e.formation.title, reason: 'acces_cloture', detail: `endDate=${e.endDate.toISOString()}` });
      continue;
    }

    // 3) Formation terminée (≥ 99%)
    if (filters.excludeCompleted && e.formationProgress && e.formationProgress.progressPercent >= 99) {
      logger.info('[reminder] SKIP formation terminee', { ...ctx, progress: e.formationProgress.progressPercent });
      skipped.push({ enrollmentId: e.id, email: e.user.email, formation: e.formation.title, reason: 'formation_terminee', detail: `progress=${e.formationProgress.progressPercent}%` });
      continue;
    }

    // 4) Délai non atteint (aucun module stagnant depuis `delayDays`)
    const stalled = e.moduleProgresses.filter((mp) => mp.updatedAt < threshold);
    if (stalled.length === 0) {
      const latest = e.moduleProgresses.reduce<Date | null>((acc, mp) => (!acc || mp.updatedAt > acc ? mp.updatedAt : acc), null);
      const daysSince = latest ? Math.floor((Date.now() - latest.getTime()) / 86_400_000) : 0;
      logger.info('[reminder] SKIP delai non atteint', { ...ctx, delayDays: filters.delayDays, daysSinceLastActivity: daysSince });
      skipped.push({ enrollmentId: e.id, email: e.user.email, formation: e.formation.title, reason: 'delai_non_atteint', detail: `delai=${filters.delayDays}j, activite il y a ${daysSince}j` });
      continue;
    }

    eligible.push({
      id: e.id,
      userId: e.userId,
      formationId: e.formationId,
      user: e.user,
      formation: e.formation,
      stalledModules: stalled.map((mp) => ({ title: mp.module.title })),
    });
    logger.debug('[reminder] ELIGIBLE', { ...ctx, stalledCount: stalled.length });
  }

  return { eligible, skipped };
}

async function hasRecentReminder(enrollmentId: string, ruleId: string, delayDays: number): Promise<boolean> {
  const since = new Date(Date.now() - delayDays * 24 * 60 * 60 * 1000);
  const existing = await prisma.reminderLog.findFirst({
    where: {
      enrollmentId,
      ruleId,
      status: 'sent',
      sentAt: { gt: since },
    },
  });
  return !!existing;
}

function splitName(fullName: string): { prenom: string; nom: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { prenom: fullName, nom: '' };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

// ─── Envoi d'une relance pour un enrollment et une règle ─────────────────────

export async function sendReminderFor(
  enrollment: EnrollmentWithContext,
  rule: { id: string; templateName: string },
): Promise<{ status: 'sent' | 'failed'; error?: string }> {
  // Récupère la version active du template
  const template = await getTemplateByName(rule.templateName);
  const { prenom, nom } = splitName(enrollment.user.fullName);

  const { subject, html } = renderTemplate(template, {
    prenom,
    nom,
    formation: enrollment.formation.title,
    modules_en_retard: enrollment.stalledModules.map((m) => m.title),
    lien_formation: `${env.WEB_URL}/formations/${enrollment.formationId}`,
  });

  try {
    await sendHtmlEmail({
      to: { email: enrollment.user.email, name: enrollment.user.fullName },
      subject,
      html,
    });

    await prisma.reminderLog.create({
      data: {
        ruleId: rule.id,
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        templateId: template.id,
        templateVersion: String(template.version),
        status: 'sent',
      },
    });
    await logEvent({
      category: 'reminder',
      action: 'reminder_sent',
      userId: enrollment.userId,
      enrollmentId: enrollment.id,
      entityType: 'enrollment',
      entityId: enrollment.id,
      payload: { template: template.name, version: template.version },
    });
    return { status: 'sent' };
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || 'unknown error';
    logger.error('Reminder email failed', { enrollmentId: enrollment.id, error: message });

    await prisma.reminderLog.create({
      data: {
        ruleId: rule.id,
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        templateId: template.id,
        templateVersion: String(template.version),
        status: 'failed',
        errorMessage: message.substring(0, 500),
      },
    });
    await logEvent({
      category: 'reminder',
      action: 'reminder_failed',
      userId: enrollment.userId,
      enrollmentId: enrollment.id,
      entityType: 'enrollment',
      entityId: enrollment.id,
      payload: { template: template.name, version: template.version, error: message },
    });
    return { status: 'failed', error: message };
  }
}

// ─── Test d'envoi manuel (admin) : email libre + template au choix ───────────

export type TestEmailOptions =
  | { type: 'simple' }
  | { type: 'db'; templateId: string };

export async function sendTestEmailTo(
  to: string,
  options: TestEmailOptions,
): Promise<{ messageId: string | null }> {
  if (options.type === 'simple') {
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const html = `<!DOCTYPE html>
<html lang="fr"><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111827;">
  <h2 style="color: ${BRAND_COLOR};">Hello world from TAA LMS</h2>
  <p>Email de test envoye le ${now} (Europe/Paris).</p>
  <p style="font-size: 12px; color: #9ca3af;">The Artist Academy — test technique de la chaine Resend.</p>
</body></html>`;
    const messageId = await sendHtmlEmail({
      to: { email: to },
      subject: 'Test TAA LMS',
      html,
    });
    return { messageId };
  }

  // type === 'db' : on prend n'importe quel template par id, donnees fake
  const tpl = await prisma.reminderTemplate.findUnique({ where: { id: options.templateId } });
  if (!tpl) throw new NotFoundError('Template');

  const { subject, html } = renderTemplate(tpl, {
    prenom: 'Test',
    nom: 'User',
    formation: 'Formation de test',
    modules_en_retard: ['Module 1 : Introduction', 'Module 2 : Notions avancees'],
    lien_formation: `${env.WEB_URL}/formations/test`,
  });
  // Variables non-standard eventuellement utilisees par des templates custom
  const extraReplacements: Record<string, string> = {
    '{{apprenant_email}}': to,
  };
  const apply = (s: string) =>
    Object.entries(extraReplacements).reduce((out, [k, v]) => out.replaceAll(k, v), s);

  const messageId = await sendHtmlEmail({
    to: { email: to },
    subject: apply(subject),
    html: apply(html),
  });
  return { messageId };
}

// ─── Job : exécute les règles actives (filtrées par hour ou toutes) ──────────

interface RunDetail {
  enrollmentId: string;
  email: string;
  ruleId: string;
  ruleName: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
  skippedReason?: string;
}

interface RunOptions {
  hour?: number;        // si défini, ne traite que les règles avec sendHour = hour
  ignoreRecent?: boolean; // si true, ne skip pas les relances déjà envoyées récemment
}

export async function runReminders(options: RunOptions = {}): Promise<{ processed: number; sent: number; failed: number; skipped: number; details: RunDetail[] }> {
  const where: any = { isActive: true, archivedAt: null };
  if (options.hour !== undefined) where.sendHour = options.hour;

  const rules = await prisma.reminderRule.findMany({ where });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const details: RunDetail[] = [];

  for (const rule of rules) {
    logger.info('[reminder] Processing rule', { rule: rule.name, delayDays: rule.delayDays });
    const { eligible, skipped: preSkipped } = await findEligibleEnrollments(
      {
        delayDays: rule.delayDays,
        excludeCompleted: rule.excludeCompleted,
        excludeExpired: rule.excludeExpired,
        excludeUnenrolled: rule.excludeUnenrolled,
      },
      rule.name,
    );

    // Skips remontés par le filtrage amont (délai, exclusions)
    for (const s of preSkipped) {
      skipped++;
      details.push({
        enrollmentId: s.enrollmentId,
        email: s.email,
        ruleId: rule.id,
        ruleName: rule.name,
        status: 'skipped',
        skippedReason: `${s.reason}${s.detail ? ' — ' + s.detail : ''}`,
      });
    }

    for (const enr of eligible) {
      // Skip anti-doublon : relance déjà envoyée récemment
      if (!options.ignoreRecent && (await hasRecentReminder(enr.id, rule.id, rule.delayDays))) {
        skipped++;
        logger.info('[reminder] SKIP deja relance', {
          enrollmentId: enr.id,
          email: enr.user.email,
          formation: enr.formation.title,
          rule: rule.name,
          delayDays: rule.delayDays,
        });
        details.push({
          enrollmentId: enr.id,
          email: enr.user.email,
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'skipped',
          skippedReason: `deja_relance — dans les ${rule.delayDays} derniers jours`,
        });
        continue;
      }
      logger.info('[reminder] SEND', { enrollmentId: enr.id, email: enr.user.email, rule: rule.name });
      const result = await sendReminderFor(enr, rule);
      if (result.status === 'sent') sent++;
      else failed++;
      details.push({
        enrollmentId: enr.id,
        email: enr.user.email,
        ruleId: rule.id,
        ruleName: rule.name,
        status: result.status,
        error: result.error,
      });
    }
  }

  logger.info('[reminder] Run summary', { hour: options.hour ?? 'all', rules: rules.length, sent, failed, skipped });
  return { processed: rules.length, sent, failed, skipped, details };
}

// Alias conservé pour le cron horaire existant
export async function runRemindersForHour(currentHour: number) {
  const { processed, sent, failed, skipped } = await runReminders({ hour: currentHour });
  return { processed, sent, failed, skipped };
}

// ─── Envoi manuel de test (admin) ────────────────────────────────────────────

export async function sendTestReminder(enrollmentId: string, ruleId?: string): Promise<{ status: 'sent' | 'failed'; error?: string }> {
  const rule = ruleId
    ? await prisma.reminderRule.findUnique({ where: { id: ruleId } })
    : await prisma.reminderRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!rule) throw new NotFoundError('Regle de relance');

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { fullName: true, email: true } },
      formation: { select: { title: true } },
      moduleProgresses: {
        where: { status: { not: 'completed' } },
        include: { module: { select: { title: true } } },
      },
    },
  });
  if (!enrollment) throw new NotFoundError('Enrollment');

  let stalled = enrollment.moduleProgresses.map((mp) => ({ title: mp.module.title }));
  if (stalled.length === 0) {
    const mods = await prisma.module.findMany({
      where: { formationId: enrollment.formationId },
      select: { title: true },
      take: 3,
      orderBy: { position: 'asc' },
    });
    stalled = mods;
  }

  return sendReminderFor(
    {
      id: enrollment.id,
      userId: enrollment.userId,
      formationId: enrollment.formationId,
      user: enrollment.user,
      formation: enrollment.formation,
      stalledModules: stalled,
    },
    { id: rule.id, templateName: rule.templateName },
  );
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export async function listReminderLogs(filters: { status?: string; formationId?: string }) {
  const where: any = {};
  if (filters.status && ['sent', 'failed', 'skipped'].includes(filters.status)) {
    where.status = filters.status;
  }
  if (filters.formationId) {
    where.enrollment = { formationId: filters.formationId };
  }

  const logs = await prisma.reminderLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: 500,
    include: {
      user: { select: { fullName: true, email: true } },
      enrollment: { select: { formationId: true, formation: { select: { title: true } } } },
      rule: { select: { id: true, name: true, delayDays: true, templateName: true } },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    ruleId: l.rule.id,
    ruleName: l.rule.name,
    ruleDelayDays: l.rule.delayDays,
    templateName: l.rule.templateName,
    templateVersion: l.templateVersion,
    formationId: l.enrollment.formationId,
    formationTitle: l.enrollment.formation.title,
    recipientName: l.user.fullName,
    recipientEmail: l.user.email,
    status: l.status,
    errorMessage: l.errorMessage,
    sentAt: l.sentAt.toISOString(),
  }));
}
