import { Request, Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { generateInternalJwt } from './auth.service';
import { BadRequestError, ForbiddenError } from '../../shared/errors';

const roleEnum = z.enum(['learner', 'trainer', 'admin', 'superadmin']);

const devLoginSchema = z.object({
  email: z.string().email(),
  roles: z.array(roleEnum).nonempty(),
  fullName: z.string().optional(),
});

const DEPRECATED_ROLE_MESSAGE = "Field 'role' is deprecated. Use 'roles' (array) instead.";

/**
 * POST /api/v1/auth/dev-login
 * Crée ou récupère un utilisateur par email et retourne un token de session LMS.
 * Actif UNIQUEMENT en NODE_ENV=development.
 */
export async function handleDevLogin(req: Request, res: Response) {
  if (env.NODE_ENV !== 'development') {
    throw new ForbiddenError('Route disponible uniquement en développement');
  }

  // Refus explicite de l'ancien format `role` (string). Décision phase 2A :
  // un seul format canonique côté API, pas de double-acceptance.
  if (req.body && typeof req.body === 'object' && 'role' in req.body) {
    throw new BadRequestError(DEPRECATED_ROLE_MESSAGE);
  }

  const parsed = devLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map(e => e.message).join(', '));
  }

  const { email, roles, fullName } = parsed.data;
  const finalRoles: UserRole[] = roles as UserRole[];

  const user = await prisma.user.upsert({
    where: { email },
    update: { roles: finalRoles, lastSeenAt: new Date() },
    create: {
      email,
      fullName: fullName || email.split('@')[0],
      roles: finalRoles,
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
    user: { id: user.id, email: user.email, roles: user.roles, fullName: user.fullName },
    token,
  });
}
