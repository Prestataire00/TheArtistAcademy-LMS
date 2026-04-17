import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './formations.service';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError } from '../../shared/errors';

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url().optional(),
  pathwayMode: z.enum(['linear', 'free']).default('free'),
  videoCompletionThreshold: z.number().int().min(1).max(100).default(99),
  isPublished: z.boolean().default(false),
  trainerId: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

function adminId(req: Request): string {
  return req.user!.userId;
}

export async function list(_req: Request, res: Response) {
  const formations = await service.listFormations();
  res.json({ data: formations });
}

export async function detail(req: Request, res: Response) {
  const formation = await service.getFormation(req.params.id);
  res.json({ data: formation });
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const formation = await service.createFormation(parsed.data);
  await logEvent({
    category: 'admin',
    action: 'formation_create',
    userId: adminId(req),
    entityType: 'formation',
    entityId: formation.id,
    payload: { title: formation.title },
  });
  res.status(201).json({ data: formation });
}

export async function update(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const formation = await service.updateFormation(req.params.id, parsed.data);
  await logEvent({
    category: 'admin',
    action: 'formation_update',
    userId: adminId(req),
    entityType: 'formation',
    entityId: formation.id,
    payload: parsed.data,
  });
  res.json({ data: formation });
}

export async function remove(req: Request, res: Response) {
  await service.deleteFormation(req.params.id);
  await logEvent({
    category: 'admin',
    action: 'formation_delete',
    userId: adminId(req),
    entityType: 'formation',
    entityId: req.params.id,
  });
  res.status(204).end();
}

export async function duplicate(req: Request, res: Response) {
  const formation = await service.duplicateFormation(req.params.id);
  await logEvent({
    category: 'admin',
    action: 'formation_duplicate',
    userId: adminId(req),
    entityType: 'formation',
    entityId: formation.id,
    payload: { sourceId: req.params.id },
  });
  res.status(201).json({ data: formation });
}
