import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import { logEvent } from '../../shared/eventLog.service';
import * as service from './users.service';

export const adminUsersRouter = Router();
adminUsersRouter.use(authenticate, requireRole('admin'));

const DEPRECATED_ROLE_MESSAGE = "Field 'role' is deprecated. Use 'roles' (array) instead.";

function rejectDeprecatedRoleField(req: Request) {
  if (req.body && typeof req.body === 'object' && 'role' in req.body) {
    throw new BadRequestError(DEPRECATED_ROLE_MESSAGE);
  }
}

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
  roles: z.array(staffRoleEnum).nonempty(),
});

adminUsersRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  rejectDeprecatedRoleField(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const user = await service.createStaffUser({
    ...parsed.data,
    roles: [...parsed.data.roles] as ('admin' | 'trainer')[],
  });

  await logEvent({
    category: 'admin',
    action: 'user_create',
    userId: req.user!.userId,
    entityType: 'user',
    entityId: user.id,
    payload: { email: user.email, roles: user.roles },
  });

  res.status(201).json({ data: user });
}));

// PUT /api/v1/admin/utilisateurs/:id
const updateSchema = z.object({
  roles: z.array(staffRoleEnum).nonempty().optional(),
  fullName: z.string().min(1).max(255).optional(),
  resetPassword: z.boolean().optional(),
});

adminUsersRouter.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  rejectDeprecatedRoleField(req);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const { roles, fullName, resetPassword } = parsed.data;
  const { user, tempPassword } = await service.updateStaffUser(req.params.id, {
    roles: roles ? ([...roles] as ('admin' | 'trainer')[]) : undefined,
    fullName,
    resetPassword,
  });

  await logEvent({
    category: 'admin',
    action: resetPassword ? 'user_reset_password' : 'user_update',
    userId: req.user!.userId,
    entityType: 'user',
    entityId: user.id,
    payload: { roles, fullName, resetPassword },
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
