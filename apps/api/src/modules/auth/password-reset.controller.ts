import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors';
import { sendPasswordResetEmail } from '../../shared/email.service';
import { logger } from '../../shared/logger';

const forgotSchema = z.object({
  email: z.string().email('Email invalide'),
});

const resetSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres'),
});

const GENERIC_MESSAGE = 'Si cette adresse est connue, un email a ete envoye.';

/**
 * POST /api/v1/auth/forgot-password
 */
export async function handleForgotPassword(req: Request, res: Response) {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const { email } = parsed.data;

  // Toujours repondre le meme message (ne jamais confirmer/infirmer l'existence)
  const user = await prisma.user.findUnique({ where: { email } });

  const isStaff = user?.roles.some((r) => r === 'admin' || r === 'trainer' || r === 'superadmin');
  if (user && isStaff && user.isActive) {
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    const resetUrl = `${env.WEB_URL}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail({
        to: { email: user.email, name: user.fullName },
        resetUrl,
        fullName: user.fullName,
      });
    } catch (err) {
      logger.error('Failed to send password reset email', { email, error: (err as Error).message });
    }
  }

  res.json({ message: GENERIC_MESSAGE });
}

/**
 * POST /api/v1/auth/reset-password
 */
export async function handleResetPassword(req: Request, res: Response) {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });

  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new BadRequestError('Lien de reinitialisation invalide ou expire');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  res.json({ message: 'Mot de passe mis a jour. Vous pouvez vous connecter.' });
}
