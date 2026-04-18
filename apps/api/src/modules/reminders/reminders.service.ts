import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { logEvent } from '../../shared/eventLog.service';
import { sendHtmlEmail } from '../../shared/email.service';
import { NotFoundError } from '../../shared/errors';

const TEMPLATE_ID = 'reminder_stalled_modules_v1';
const BRAND_COLOR = '#B5294E';

interface EnrollmentWithContext {
  id: string;
  userId: string;
  formationId: string;
  user: { fullName: string; email: string };
  formation: { title: string };
  stalledModules: { title: string }[];
}

/**
 * Génère le template HTML de relance aux couleurs The Artist Academy.
 */
export function buildReminderHtml(params: {
  fullName: string;
  formationTitle: string;
  stalledModules: string[];
  formationUrl: string;
}): { subject: string; html: string } {
  const moduleList = params.stalledModules
    .map((m) => `<li style="margin-bottom: 4px; color: #374151;">${escapeHtml(m)}</li>`)
    .join('');

  const subject = `Reprenez votre formation : ${params.formationTitle}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f8;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 28px 32px 16px 32px; border-bottom: 3px solid ${BRAND_COLOR};">
              <div style="font-size: 22px; font-weight: 700; color: ${BRAND_COLOR}; letter-spacing: 0.5px;">THE ARTIST ACADEMY</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; color: #111827; margin: 0 0 16px 0;">Bonjour ${escapeHtml(params.fullName)},</p>
              <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                Vous n'avez pas termine les modules suivants de votre formation
                <strong>${escapeHtml(params.formationTitle)}</strong> :
              </p>
              <ul style="font-size: 15px; padding-left: 20px; margin: 0 0 24px 0;">
                ${moduleList}
              </ul>
              <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 28px 0;">
                Prenez quelques minutes pour poursuivre votre parcours.
              </p>
              <p style="text-align: center; margin: 0 0 24px 0;">
                <a href="${params.formationUrl}" style="display: inline-block; padding: 13px 32px; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Reprendre ma formation
                </a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #fafafb; border-top: 1px solid #eef0f2;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                The Artist Academy — Cet email est automatique, ne pas repondre.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Récupère ou crée la règle "système" par défaut (délai REMINDER_DELAY_DAYS, global).
 */
async function getDefaultRule(delayDays: number): Promise<string> {
  const existing = await prisma.reminderRule.findFirst({
    where: { formationId: null, delayDays, templateId: TEMPLATE_ID },
  });
  if (existing) return existing.id;

  const admin = await prisma.user.findFirst({
    where: { role: { in: ['admin', 'superadmin'] } },
    select: { id: true },
  });
  const rule = await prisma.reminderRule.create({
    data: {
      formationId: null,
      delayDays,
      templateId: TEMPLATE_ID,
      isActive: true,
      createdBy: admin?.id ?? 'system',
    },
  });
  return rule.id;
}

/**
 * Sélectionne les enrollments éligibles à une relance :
 * - au moins un module non terminé depuis delayDays
 * - formation non terminée (FormationProgress.status != completed)
 * - accès actif (endDate > now, status != closed)
 */
async function findEligibleEnrollments(delayDays: number): Promise<EnrollmentWithContext[]> {
  const threshold = new Date(Date.now() - delayDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: 'active',
      endDate: { gt: now },
      OR: [
        { formationProgress: { is: null } },
        { formationProgress: { status: { not: 'completed' } } },
      ],
      moduleProgresses: {
        some: {
          status: { not: 'completed' },
          updatedAt: { lt: threshold },
        },
      },
    },
    include: {
      user: { select: { fullName: true, email: true } },
      formation: { select: { title: true } },
      moduleProgresses: {
        where: { status: { not: 'completed' }, updatedAt: { lt: threshold } },
        include: { module: { select: { title: true } } },
      },
    },
  });

  return enrollments
    .filter((e) => e.moduleProgresses.length > 0)
    .map((e) => ({
      id: e.id,
      userId: e.userId,
      formationId: e.formationId,
      user: e.user,
      formation: e.formation,
      stalledModules: e.moduleProgresses.map((mp) => ({ title: mp.module.title })),
    }));
}

/**
 * Vérifie qu'aucune relance (sent) n'a déjà été envoyée sur cet enrollment
 * pour cette règle dans les delayDays qui précèdent.
 */
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

/**
 * Envoie une relance pour un enrollment et logge le résultat.
 */
export async function sendReminderFor(enrollment: EnrollmentWithContext, ruleId: string): Promise<{ status: 'sent' | 'failed'; error?: string }> {
  const { subject, html } = buildReminderHtml({
    fullName: enrollment.user.fullName,
    formationTitle: enrollment.formation.title,
    stalledModules: enrollment.stalledModules.map((m) => m.title),
    formationUrl: `${env.WEB_URL}/formations/${enrollment.formationId}`,
  });

  try {
    await sendHtmlEmail({
      to: { email: enrollment.user.email, name: enrollment.user.fullName },
      subject,
      html,
    });

    await prisma.reminderLog.create({
      data: {
        ruleId,
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        templateId: TEMPLATE_ID,
        templateVersion: '1',
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
      payload: { template: TEMPLATE_ID, modules: enrollment.stalledModules.map((m) => m.title) },
    });
    return { status: 'sent' };
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || 'unknown error';
    logger.error('Reminder email failed', { enrollmentId: enrollment.id, error: message });

    await prisma.reminderLog.create({
      data: {
        ruleId,
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        templateId: TEMPLATE_ID,
        templateVersion: '1',
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
      payload: { template: TEMPLATE_ID, error: message },
    });
    return { status: 'failed', error: message };
  }
}

/**
 * Job quotidien : envoie les relances aux enrollments éligibles.
 */
export async function sendDailyReminders(): Promise<{ eligible: number; sent: number; failed: number; skipped: number }> {
  const delayDays = env.REMINDER_DELAY_DAYS;
  const ruleId = await getDefaultRule(delayDays);
  const eligible = await findEligibleEnrollments(delayDays);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const enr of eligible) {
    if (await hasRecentReminder(enr.id, ruleId, delayDays)) {
      skipped++;
      continue;
    }
    const result = await sendReminderFor(enr, ruleId);
    if (result.status === 'sent') sent++;
    else failed++;
  }

  logger.info('Daily reminder job summary', { eligible: eligible.length, sent, failed, skipped });
  return { eligible: eligible.length, sent, failed, skipped };
}

/**
 * Envoi manuel d'une relance de test pour un enrollment donné (admin).
 */
export async function sendTestReminder(enrollmentId: string): Promise<{ status: 'sent' | 'failed'; error?: string }> {
  const delayDays = env.REMINDER_DELAY_DAYS;
  const ruleId = await getDefaultRule(delayDays);

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

  // Pour un test manuel, si aucun module en cours, on liste les modules de la formation
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
    ruleId,
  );
}

/**
 * Journal des relances avec filtres.
 */
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
      rule: { select: { delayDays: true, formation: { select: { title: true } } } },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    ruleName: l.rule.formation?.title
      ? `${l.rule.formation.title} — ${l.rule.delayDays}j`
      : `Global — ${l.rule.delayDays}j`,
    formationId: l.enrollment.formationId,
    formationTitle: l.enrollment.formation.title,
    recipientName: l.user.fullName,
    recipientEmail: l.user.email,
    templateId: l.templateId,
    status: l.status,
    errorMessage: l.errorMessage,
    sentAt: l.sentAt.toISOString(),
  }));
}
