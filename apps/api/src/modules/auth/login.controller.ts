import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { generateInternalJwt } from './auth.service';
import { logEvent } from '../../shared/eventLog.service';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError, ForbiddenError } from '../../shared/errors';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

/**
 * POST /api/v1/auth/login
 * Authentification email + mot de passe pour les rôles trainer et admin.
 * Refuse les learners (ils passent uniquement par SSO Dendreo).
 */
export async function handleLogin(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  if (user.role === 'learner') {
    throw new ForbiddenError('Les apprenants doivent se connecter via Dendreo');
  }

  if (!user.isActive) {
    throw new ForbiddenError('Compte desactive');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  // Mettre a jour lastSeenAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  // Logger la connexion
  await logEvent({
    category: 'admin',
    action: 'login_password',
    userId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const token = generateInternalJwt(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h
  });

  res.json({
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    token,
  });
}
