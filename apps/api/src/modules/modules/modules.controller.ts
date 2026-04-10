import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './modules.service';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError } from '../../shared/errors';

const createSchema = z.object({
  formationId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  isPublished: z.boolean().default(false),
});

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

function adminId(req: Request): string {
  return req.user!.userId;
}

export async function list(req: Request, res: Response) {
  const modules = await service.listModules(req.params.formationId);
  res.json({ data: modules });
}

export async function detail(req: Request, res: Response) {
  const mod = await service.getModule(req.params.id);
  res.json({ data: mod });
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const mod = await service.createModule(parsed.data);
  await logEvent({
    category: 'admin',
    action: 'module_create',
    userId: adminId(req),
    entityType: 'module',
    entityId: mod.id,
    payload: { title: mod.title, formationId: parsed.data.formationId },
  });
  res.status(201).json({ data: mod });
}

export async function update(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const mod = await service.updateModule(req.params.id, parsed.data);
  await logEvent({
    category: 'admin',
    action: 'module_update',
    userId: adminId(req),
    entityType: 'module',
    entityId: mod.id,
    payload: parsed.data,
  });
  res.json({ data: mod });
}

export async function remove(req: Request, res: Response) {
  await service.deleteModule(req.params.id);
  await logEvent({
    category: 'admin',
    action: 'module_delete',
    userId: adminId(req),
    entityType: 'module',
    entityId: req.params.id,
  });
  res.status(204).end();
}

export async function reorder(req: Request, res: Response) {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const modules = await service.reorderModules(req.params.formationId, parsed.data.orderedIds);
  await logEvent({
    category: 'admin',
    action: 'module_reorder',
    userId: adminId(req),
    entityType: 'formation',
    entityId: req.params.formationId,
    payload: { orderedIds: parsed.data.orderedIds },
  });
  res.json({ data: modules });
}

export async function duplicate(req: Request, res: Response) {
  const mod = await service.duplicateModule(req.params.id);
  await logEvent({
    category: 'admin',
    action: 'module_duplicate',
    userId: adminId(req),
    entityType: 'module',
    entityId: mod.id,
    payload: { sourceId: req.params.id },
  });
  res.status(201).json({ data: mod });
}
