import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './uas.service';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError } from '../../shared/errors';

const createSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1).max(255),
  type: z.enum(['video', 'quiz', 'resource']),
  isPublished: z.boolean().default(false),
});

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  isPublished: z.boolean().optional(),
});

function adminId(req: Request): string {
  return req.user!.userId;
}

export async function list(req: Request, res: Response) {
  const uas = await service.listUAs(req.params.moduleId);
  res.json({ data: uas });
}

export async function detail(req: Request, res: Response) {
  const ua = await service.getUA(req.params.id);
  res.json({ data: ua });
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const ua = await service.createUA(parsed.data);
  await logEvent({
    category: 'admin',
    action: 'ua_create',
    userId: adminId(req),
    entityType: 'ua',
    entityId: ua.id,
    payload: { title: ua.title, type: ua.type, moduleId: parsed.data.moduleId },
  });
  res.status(201).json({ data: ua });
}

export async function update(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const ua = await service.updateUA(req.params.id, parsed.data);
  await logEvent({
    category: 'admin',
    action: 'ua_update',
    userId: adminId(req),
    entityType: 'ua',
    entityId: ua.id,
    payload: parsed.data,
  });
  res.json({ data: ua });
}

export async function remove(req: Request, res: Response) {
  await service.deleteUA(req.params.id);
  await logEvent({
    category: 'admin',
    action: 'ua_delete',
    userId: adminId(req),
    entityType: 'ua',
    entityId: req.params.id,
  });
  res.status(204).end();
}
