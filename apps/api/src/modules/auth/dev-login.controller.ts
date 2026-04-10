import { Request, Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { generateInternalJwt } from './auth.service';
import { BadRequestError, ForbiddenError } from '../../shared/errors';

const devLoginSchema = z.object({
  email: z.string().email(),
  role: z.enum(['learner', 'trainer', 'admin', 'superadmin']).default('learner'),
  fullName: z.string().optional(),
});

/**
 * POST /api/v1/auth/dev-login
 * Crée ou récupère un utilisateur par email et retourne un token de session LMS.
 * Actif UNIQUEMENT en NODE_ENV=development.
 */
export async function handleDevLogin(req: Request, res: Response) {
  if (env.NODE_ENV !== 'development') {
    throw new ForbiddenError('Route disponible uniquement en développement');
  }

  const parsed = devLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map(e => e.message).join(', '));
  }

  const { email, role, fullName } = parsed.data;

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: role as UserRole, lastSeenAt: new Date() },
    create: {
      email,
      fullName: fullName || email.split('@')[0],
      role: role as UserRole,
      lastSeenAt: new Date(),
    },
  });

  const token = generateInternalJwt(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    token,
  });
}
