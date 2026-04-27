import { Request, Response } from 'express';
import { env } from '../../config/env';

/**
 * POST /api/v1/auth/logout
 * Efface le cookie httpOnly côté serveur. Le frontend complète en purgeant
 * localStorage.token. Pas de révocation JWT en V1 (pas de Redis) — le token
 * reste valide jusqu'à expiration s'il a été extrait avant logout.
 */
export function handleLogout(_req: Request, res: Response) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ ok: true });
}
