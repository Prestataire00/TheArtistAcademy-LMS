import { Request, Response } from 'express';
import { validateDendreoToken, upsertUserAndEnrollment, generateInternalJwt } from './auth.service';
import { logEvent } from '../../shared/eventLog.service';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError } from '../../shared/errors';

export async function handleSso(req: Request, res: Response) {
  const rawToken = req.body.token || req.query.token as string;

  if (!rawToken) throw new BadRequestError('Token SSO manquant');

  // 1. Valider le JWT Dendreo
  const dendreoPayload = await validateDendreoToken(rawToken);

  // 2. Upsert User + Enrollment
  const { user, enrollment } = await upsertUserAndEnrollment(dendreoPayload);

  // 3. Logger l'événement SSO
  await logEvent({
    category: 'sso',
    action: 'sso_success',
    userId: user.id,
    enrollmentId: enrollment.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // 4. Générer JWT interne + cookie httpOnly
  const internalToken = generateInternalJwt(user);
  res.cookie('token', internalToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h
  });

  // 5. Retourner l'URL de redirection vers la formation
  res.json({
    redirectUrl: `/formations/${enrollment.formationId}`,
    enrollmentId: enrollment.id,
  });
}

export async function getSsoStatus(_req: Request, res: Response) {
  // TODO: Phase 2 — retourner les logs SSO récents et stats
  res.json({ status: 'ok', message: 'SSO status endpoint - à implémenter en Phase 2' });
}
