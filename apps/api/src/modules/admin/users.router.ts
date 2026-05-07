import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import { logEvent } from '../../shared/eventLog.service';
import * as service from './users.service';

export const adminUsersRouter = Router();
adminUsersRouter.use(authenticate, requireRole('admin', 'superadmin'));

// GET /api/v1/admin/utilisateurs
adminUsersRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.listStaffUsers();
  res.json({ data });
}));

// POST /api/v1/admin/utilisateurs
const staffRoleEnum = z.enum(['admin', 'trainer']);
const createSchema = z.object({
  email: z.string().email('Email invalide'),
  fullName: z.string().min(1, 'Nom requis').max(255),
  password: z.string().min(8, 'Mot de passe : 8 caracteres minimum'),
  role: staffRoleEnum,
});

adminUsersRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const user = await service.createStaffUser(parsed.data);

  await logEvent({
    category: 'admin',
    action: 'user_create',
    userId: req.user!.userId,
    entityType: 'user',
    entityId: user.id,
    payload: { email: user.email, role: user.role },
  });

  res.status(201).json({ data: user });
}));

// PUT /api/v1/admin/utilisateurs/:id
const updateSchema = z.object({
  role: staffRoleEnum.optional(),
  fullName: z.string().min(1).max(255).optional(),
  resetPassword: z.boolean().optional(),
});

adminUsersRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const { role, fullName, resetPassword } = parsed.data;
  const { user, tempPassword } = await service.updateStaffUser(req.params.id, {
    role,
    fullName,
    resetPassword,
  });

  await logEvent({
    category: 'admin',
    action: resetPassword ? 'user_reset_password' : 'user_update',
    userId: req.user!.userId,
    entityType: 'user',
    entityId: user.id,
    payload: { role, fullName, resetPassword },
  });

  res.json({ data: user, tempPassword });
}));

// DELETE /api/v1/admin/utilisateurs/:id
adminUsersRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await service.deleteStaffUser(req.params.id, req.user!.userId);

  await logEvent({
    category: 'admin',
    action: 'user_delete',
    userId: req.user!.userId,
    entityType: 'user',
    entityId: req.params.id,
  });

  res.status(204).end();
}));
