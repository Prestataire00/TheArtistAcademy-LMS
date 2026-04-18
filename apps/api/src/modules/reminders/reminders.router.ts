import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import { logEvent } from '../../shared/eventLog.service';
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

// GET /api/v1/admin/relances/rules
remindersRouter.get('/rules', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.listRules();
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

// DELETE /api/v1/admin/relances/rules/:id
remindersRouter.delete('/rules/:id', asyncHandler(async (req: Request, res: Response) => {
  await service.deleteRule(req.params.id);
  await logEvent({ category: 'admin', action: 'reminder_rule_delete', userId: req.user!.userId, entityType: 'reminder_rule', entityId: req.params.id, ipAddress: req.ip });
  res.status(204).end();
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
