import { Request, Response } from 'express';
import { validateDendreoToken, upsertUserAndEnrollment, generateInternalJwt } from './auth.service';
import { logEvent } from '../../shared/eventLog.service';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors';

/**
 * GET /auth/sso?jwt=xxx&return_to=...&dendreo_return_to=...
 * Entrée SSO Dendreo : valide le JWT HS256, crée session, redirige.
 */
export async function handleSso(req: Request, res: Response) {
  const rawToken = req.query.jwt as string || req.body.token as string || req.query.token as string;

  if (!rawToken) throw new BadRequestError('Token SSO manquant');

  let dendreoPayload;
  let upserted;
  try {
    // 1. Valider le JWT Dendreo (HS256)
    dendreoPayload = await validateDendreoToken(rawToken);
    // 2. Upsert User + Enrollment
    upserted = await upsertUserAndEnrollment(dendreoPayload);
  } catch (err: any) {
    await logEvent({
      category: 'sso',
      action: 'sso_failed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { error: err?.message ?? 'unknown', email: dendreoPayload?.email },
    });
    throw err;
  }
  const { user, enrollment } = upserted;

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
  const cookieOpts = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 8 * 60 * 60 * 1000, // 8h
  };

  res.cookie('token', internalToken, cookieOpts);

  // 5. Stocker dendreo_return_to en cookie pour le bouton "Mes formations"
  const dendreoReturnTo = req.query.dendreo_return_to as string;
  if (dendreoReturnTo) {
    res.cookie('dendreo_return_to', dendreoReturnTo, {
      httpOnly: false, // accessible côté client pour le bouton "Mes formations"
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
  }

  // 6. Rediriger vers return_to (formation ciblée) ou page par défaut
  const returnTo = req.query.return_to as string || `/formations/${enrollment.formationId}`;
  res.redirect(returnTo);
}

export async function getSsoStatus(_req: Request, res: Response) {
  // TODO: Phase 2 — retourner les logs SSO récents et stats
  res.json({ status: 'ok', message: 'SSO status endpoint - à implémenter en Phase 2' });
}
