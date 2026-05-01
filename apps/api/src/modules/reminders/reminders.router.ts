import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { testEmailRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler, BadRequestError, NotFoundError } from '../../shared/errors';
import { logEvent } from '../../shared/eventLog.service';
import { checkEmailTld } from '../../shared/email.service';
import * as service from './reminders.service';

export const remindersRouter = Router();
remindersRouter.use(authenticate, requireRole('admin'));

// ─── Journal ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/relances
remindersRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, formationId } = req.query as Record<string, string | undefined>;
  const data = await service.listReminderLogs({ status, formationId });
  res.json({ data });
}));

// POST /api/v1/admin/relances/run-now — déclenche immédiatement l'envoi des relances
remindersRouter.post('/run-now', asyncHandler(async (req: Request, res: Response) => {
  const result = await service.runReminders();
  await logEvent({
    category: 'admin',
    action: 'reminder_run_now',
    userId: req.user!.userId,
    payload: { sent: result.sent, failed: result.failed, skipped: result.skipped, processed: result.processed },
    ipAddress: req.ip,
  });
  res.json({ data: { sent: result.sent, failed: result.failed, skipped: result.skipped, processed: result.processed, details: result.details } });
}));

// POST /api/v1/admin/relances/test-email — envoi manuel a une adresse libre
const testEmailSchema = z
  .object({
    to: z.string().email('Adresse email invalide'),
    templateType: z.enum(['simple', 'db']),
    templateId: z.string().uuid().optional(),
    force: z.boolean().optional(),
  })
  .refine((d) => d.templateType !== 'db' || !!d.templateId, {
    message: 'templateId requis quand templateType=db',
    path: ['templateId'],
  });

remindersRouter.post(
  '/test-email',
  testEmailRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = testEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { to, templateType, templateId, force } = parsed.data;

    // Validation TLD : evite les fautes de frappe qui bouncent immediatement.
    // L'admin peut contourner avec force=true pour les TLD inhabituels legitimes.
    if (!force) {
      const tldCheck = checkEmailTld(to);
      if (!tldCheck.ok) {
        await logEvent({
          category: 'admin',
          action: 'email_test',
          userId: req.user!.userId,
          payload: { to, templateType, templateId, result: 'rejected', reason: 'invalid_tld', tld: tldCheck.tld },
          ipAddress: req.ip,
        });
        return res.status(422).json({
          error: {
            code: 'INVALID_TLD',
            message: `Le domaine de destination semble invalide (TLD non reconnu : .${tldCheck.tld ?? '?'}). Si tu es sur que c'est valide, coche "Forcer l'envoi" pour contourner cette validation.`,
          },
        });
      }
    }

    const options: service.TestEmailOptions =
      templateType === 'simple' ? { type: 'simple' } : { type: 'db', templateId: templateId! };

    try {
      const { messageId } = await service.sendTestEmailTo(to, options);
      await logEvent({
        category: 'admin',
        action: 'email_test',
        userId: req.user!.userId,
        payload: { to, templateType, templateId, force: !!force, result: 'success', messageId },
        ipAddress: req.ip,
      });
      return res.json({ success: true, messageId, to });
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        await logEvent({
          category: 'admin',
          action: 'email_test',
          userId: req.user!.userId,
          payload: { to, templateType, templateId, result: 'error', error: 'template_not_found' },
          ipAddress: req.ip,
        });
        return res.status(404).json({
          error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template introuvable.' },
        });
      }
      const message = err?.message || 'Echec de l\'envoi';
      await logEvent({
        category: 'admin',
        action: 'email_test',
        userId: req.user!.userId,
        payload: { to, templateType, templateId, force: !!force, result: 'error', error: message },
        ipAddress: req.ip,
      });
      return res.status(502).json({
        error: {
          code: 'EMAIL_SEND_FAILED',
          message,
          details: err?.details ?? undefined,
        },
      });
    }
  }),
);

// GET /api/v1/admin/relances/test/:enrollmentId
remindersRouter.get('/test/:enrollmentId', asyncHandler(async (req: Request, res: Response) => {
  const { enrollmentId } = req.params;
  const { ruleId } = req.query as Record<string, string | undefined>;
  const result = await service.sendTestReminder(enrollmentId, ruleId);
  await logEvent({
    category: 'admin',
    action: 'reminder_test',
    userId: req.user!.userId,
    enrollmentId,
    payload: { status: result.status, ruleId },
    ipAddress: req.ip,
  });
  res.json({ data: result });
}));

// ─── Rules CRUD ──────────────────────────────────────────────────────────────

const ruleCreateSchema = z.object({
  name: z.string().min(1),
  delayDays: z.number().int().min(1).max(365),
  sendHour: z.number().int().min(0).max(23),
  templateName: z.string().min(1),
  isActive: z.boolean().optional(),
  excludeCompleted: z.boolean().optional(),
  excludeExpired: z.boolean().optional(),
  excludeUnenrolled: z.boolean().optional(),
});

const ruleUpdateSchema = ruleCreateSchema.partial();

// GET /api/v1/admin/relances/rules?includeArchived=1
remindersRouter.get('/rules', asyncHandler(async (req: Request, res: Response) => {
  const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';
  const data = await service.listRules({ includeArchived });
  res.json({ data });
}));

// POST /api/v1/admin/relances/rules
remindersRouter.post('/rules', asyncHandler(async (req: Request, res: Response) => {
  const parsed = ruleCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues.map((i) => i.message).join('; '));
  const rule = await service.createRule(parsed.data);
  await logEvent({ category: 'admin', action: 'reminder_rule_create', userId: req.user!.userId, entityType: 'reminder_rule', entityId: rule.id, ipAddress: req.ip });
  res.json({ data: rule });
}));

// PUT /api/v1/admin/relances/rules/:id
remindersRouter.put('/rules/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = ruleUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues.map((i) => i.message).join('; '));
  const rule = await service.updateRule(req.params.id, parsed.data);
  await logEvent({ category: 'admin', action: 'reminder_rule_update', userId: req.user!.userId, entityType: 'reminder_rule', entityId: rule.id, ipAddress: req.ip });
  res.json({ data: rule });
}));

// POST /api/v1/admin/relances/rules/:id/archive — soft-delete, conserve les logs
remindersRouter.post('/rules/:id/archive', asyncHandler(async (req: Request, res: Response) => {
  const rule = await service.archiveRule(req.params.id);
  await logEvent({ category: 'admin', action: 'reminder_rule_archive', userId: req.user!.userId, entityType: 'reminder_rule', entityId: rule.id, ipAddress: req.ip });
  res.json({ data: rule });
}));

// POST /api/v1/admin/relances/rules/:id/unarchive
remindersRouter.post('/rules/:id/unarchive', asyncHandler(async (req: Request, res: Response) => {
  const rule = await service.unarchiveRule(req.params.id);
  await logEvent({ category: 'admin', action: 'reminder_rule_unarchive', userId: req.user!.userId, entityType: 'reminder_rule', entityId: rule.id, ipAddress: req.ip });
  res.json({ data: rule });
}));

// ─── Templates CRUD ──────────────────────────────────────────────────────────

const templateCreateSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Nom invalide : lettres minuscules, chiffres et _ uniquement'),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
});

const templateUpdateSchema = z.object({
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
});

// GET /api/v1/admin/relances/templates
remindersRouter.get('/templates', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.listTemplates();
  res.json({ data });
}));

// GET /api/v1/admin/relances/templates/:name — version active
remindersRouter.get('/templates/:name', asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getTemplateByName(req.params.name);
  res.json({ data });
}));

// GET /api/v1/admin/relances/templates/:name/history
remindersRouter.get('/templates/:name/history', asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getTemplateHistory(req.params.name);
  res.json({ data });
}));

// POST /api/v1/admin/relances/templates
remindersRouter.post('/templates', asyncHandler(async (req: Request, res: Response) => {
  const parsed = templateCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues.map((i) => i.message).join('; '));
  const tpl = await service.createTemplate(parsed.data);
  await logEvent({ category: 'admin', action: 'reminder_template_create', userId: req.user!.userId, entityType: 'reminder_template', entityId: tpl.id, payload: { name: tpl.name, version: tpl.version }, ipAddress: req.ip });
  res.json({ data: tpl });
}));

// PUT /api/v1/admin/relances/templates/:name — crée une nouvelle version
remindersRouter.put('/templates/:name', asyncHandler(async (req: Request, res: Response) => {
  const parsed = templateUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues.map((i) => i.message).join('; '));
  const tpl = await service.updateTemplate(req.params.name, parsed.data);
  await logEvent({ category: 'admin', action: 'reminder_template_update', userId: req.user!.userId, entityType: 'reminder_template', entityId: tpl.id, payload: { name: tpl.name, version: tpl.version }, ipAddress: req.ip });
  res.json({ data: tpl });
}));

// POST /api/v1/admin/relances/templates/:name/duplicate
remindersRouter.post('/templates/:name/duplicate', asyncHandler(async (req: Request, res: Response) => {
  const tpl = await service.duplicateTemplate(req.params.name);
  await logEvent({ category: 'admin', action: 'reminder_template_duplicate', userId: req.user!.userId, entityType: 'reminder_template', entityId: tpl.id, payload: { source: req.params.name, name: tpl.name }, ipAddress: req.ip });
  res.json({ data: tpl });
}));

// DELETE /api/v1/admin/relances/templates/:name — supprime toutes les versions
remindersRouter.delete('/templates/:name', asyncHandler(async (req: Request, res: Response) => {
  await service.deleteTemplate(req.params.name);
  await logEvent({ category: 'admin', action: 'reminder_template_delete', userId: req.user!.userId, entityType: 'reminder_template', entityId: req.params.name, payload: { name: req.params.name }, ipAddress: req.ip });
  res.status(204).end();
}));
