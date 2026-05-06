import { Request, Response } from 'express';
import {
  validateDendreoToken,
  findUserForSso,
  findEnrollmentForSso,
  markDendreoTokenConsumed,
  generateInternalJwt,
} from './auth.service';
import { logEvent } from '../../shared/eventLog.service';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/errors';

/**
 * GET /auth/sso?jwt=xxx&return_to=...&dendreo_return_to=...
 *
 * Séquence stricte (le SSO ne crée jamais de user/enrollment) :
 *   1. validateDendreoToken : vérifie signature HS256 + iat<=5min + jti pas
 *      déjà consommé (lecture seule sur la table jti).
 *   2. findUserForSso     : lookup user. 404 USER_NOT_FOUND si absent (le
 *      compte doit être créé en amont par webhook user.created).
 *   3. findEnrollmentForSso : lookup enrollment. 403 ENROLLMENT_NOT_FOUND
 *      si le user n'est pas inscrit à la formation cible.
 *   4. markDendreoTokenConsumed : seulement maintenant on brûle le jti.
 *   5. generateInternalJwt + cookie + redirect /sso/dendreo.
 *
 * Codes HTTP retournés (via errorHandler global qui mappe AppError) :
 *   - 401 UNAUTHORIZED         JWT invalide/expiré/déjà consommé
 *   - 404 USER_NOT_FOUND       user absent en DB
 *   - 403 ENROLLMENT_NOT_FOUND user non inscrit
 *   - 500 INTERNAL_ERROR       erreur DB inattendue (stack trace dans logs)
 */
export async function handleSso(req: Request, res: Response) {
  const rawToken =
    (req.query.jwt as string) ||
    (req.body?.token as string) ||
    (req.query.token as string);

  if (!rawToken) throw new BadRequestError('Token SSO manquant');

  // Étape 1 : validation pure du JWT (pas de write DB)
  let dendreoPayload;
  try {
    dendreoPayload = await validateDendreoToken(rawToken);
  } catch (err: any) {
    await logEvent({
      category: 'sso',
      action: 'sso_failed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: { stage: 'validate_token', error: err?.message ?? 'unknown' },
    });
    throw err;
  }

  // Étape 2 : lookup user (404 si absent)
  let user;
  try {
    user = await findUserForSso(dendreoPayload);
  } catch (err: any) {
    await logEvent({
      category: 'sso',
      action: 'sso_failed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: {
        stage: 'find_user',
        code: err?.code,
        error: err?.message,
        email: dendreoPayload.email,
        user_id: dendreoPayload.user_id ?? dendreoPayload.sub,
      },
    });
    throw err;
  }

  // Étape 3 : lookup enrollment (403 si absent)
  let enrollment;
  try {
    enrollment = await findEnrollmentForSso(user, dendreoPayload);
  } catch (err: any) {
    await logEvent({
      category: 'sso',
      action: 'sso_failed',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      payload: {
        stage: 'find_enrollment',
        code: err?.code,
        error: err?.message,
        training_id: dendreoPayload.training_id ?? dendreoPayload.formation_id,
      },
    });
    throw err;
  }

  // Étape 4 : marquer le jti consommé maintenant que tout est OK
  await markDendreoTokenConsumed(dendreoPayload);

  // Étape 5 : log success + cookies + redirect
  await logEvent({
    category: 'sso',
    action: 'sso_success',
    userId: user.id,
    enrollmentId: enrollment.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const internalToken = generateInternalJwt(user);
  const cookieOpts = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 8 * 60 * 60 * 1000, // 8h
  };

  res.cookie('token', internalToken, cookieOpts);

  // Cookie dendreo_return_to lisible côté client (bouton "Retour Dendreo")
  const dendreoReturnTo = req.query.dendreo_return_to as string | undefined;
  if (dendreoReturnTo) {
    res.cookie('dendreo_return_to', dendreoReturnTo, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
  }

  // Redirect : return_to explicite (override) ou page de relais SSO web.
  // L'API et le Web sont sur des domaines distincts (Railway) : tous les
  // redirects qui pointent vers le Web doivent être ABSOLUS, sinon le
  // navigateur reste sur le domaine API.
  //
  // Quand return_to pointe vers notre Web, on append `token=<internalJwt>` :
  // le middleware Next.js l'intercepte, le pose en cookie HttpOnly côté Web,
  // puis redirige vers la même URL nettoyée. Sans ça, le frontend arrive sur
  // /formations/[id] sans session (la page de relais /sso/dendreo n'est jamais
  // chargée quand return_to est fourni par Dendreo).
  const explicitReturnTo = req.query.return_to as string | undefined;
  if (explicitReturnTo) {
    const absoluteReturnTo = /^https?:\/\//i.test(explicitReturnTo)
      ? explicitReturnTo
      : `${env.WEB_URL}${explicitReturnTo.startsWith('/') ? '' : '/'}${explicitReturnTo}`;

    let finalUrl = absoluteReturnTo;
    try {
      const target = new URL(absoluteReturnTo);
      const webOrigin = new URL(env.WEB_URL);
      if (target.host === webOrigin.host) {
        target.searchParams.set('token', internalToken);
        finalUrl = target.toString();
      }
    } catch {
      // URL malformée : on laisse passer l'URL d'origine, le navigateur tranchera.
    }

    res.redirect(finalUrl);
    return;
  }

  const ssoLandingParams = new URLSearchParams({
    token: internalToken,
    training_id: enrollment.formationId,
    enrolment_id: enrollment.id,
  });
  res.redirect(`${env.WEB_URL}/sso/dendreo?${ssoLandingParams.toString()}`);
}

export async function getSsoStatus(_req: Request, res: Response) {
  res.json({ status: 'ok', message: 'SSO status endpoint - à implémenter en Phase 2' });
}
