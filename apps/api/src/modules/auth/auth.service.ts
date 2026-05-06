import jwt from 'jsonwebtoken';
import { User, Enrollment } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError, UnauthorizedError } from '../../shared/errors';
import { AuthPayload } from '../../middleware/auth';
import { logger } from '../../shared/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload JWT Dendreo. Supporte deux formats :
 * - Nouvelle spec : `user_id`, `training_id`, `firstname`+`lastname`
 * - Ancien format : `sub`, `formation_id`, `full_name`
 *
 * Les helpers `extractUserId` / `extractTrainingId` / `extractFullName` lisent
 * la nouvelle clé en priorité avec fallback sur l'ancienne.
 */
export interface DendreoJwtPayload {
  // Nouvelle spec
  user_id?: string;
  training_id?: string;
  firstname?: string;
  lastname?: string;
  enrolment_id?: string;
  session_id?: string;

  // Ancien format
  sub?: string;
  formation_id?: string;
  full_name?: string;

  // Communs
  email?: string;
  start_date?: string;
  end_date?: string;
  iat: number;
  exp?: number;
  jti?: string;
}

export class SsoUserNotFoundError extends AppError {
  constructor(detail?: string) {
    super(
      404,
      detail
        ? `Utilisateur non trouvé : ${detail}. Le compte doit être créé via webhook user.created avant le SSO.`
        : 'Utilisateur non trouvé. Le compte doit être créé via webhook user.created avant le SSO.',
      'USER_NOT_FOUND',
    );
  }
}

export class SsoEnrollmentNotFoundError extends AppError {
  constructor(detail?: string) {
    super(
      403,
      detail
        ? `Inscription introuvable : ${detail}. Le user existe mais n'est pas inscrit à cette formation.`
        : "Inscription introuvable : le user existe mais n'est pas inscrit à cette formation.",
      'ENROLLMENT_NOT_FOUND',
    );
  }
}

// ─── Helpers d'extraction (compat ancien/nouveau format) ─────────────────────

function extractUserId(payload: DendreoJwtPayload): string | undefined {
  return payload.user_id ?? payload.sub;
}

function extractTrainingId(payload: DendreoJwtPayload): string | undefined {
  return payload.training_id ?? payload.formation_id;
}

// ─── 1. Validation du JWT (signature + iat <= 5min, sans toucher la DB) ──────

/**
 * Vérifie la signature HS256 du JWT Dendreo et son âge (iat <= 5 min).
 * NE marque PAS le jti comme consommé — c'est le rôle de
 * `markDendreoTokenConsumed`, à appeler seulement après que le user et
 * l'enrollment aient été trouvés. Vérifie quand même qu'un jti déjà utilisé
 * n'est pas rejoué (lecture seule).
 */
export async function validateDendreoToken(rawToken: string): Promise<DendreoJwtPayload> {
  const ssoSecret = env.DENDREO_SIGNATURE_KEY || env.DENDREO_JWT_SECRET;
  if (!ssoSecret) {
    throw new UnauthorizedError('Configuration SSO Dendreo manquante');
  }

  let payload: DendreoJwtPayload;
  try {
    payload = jwt.verify(rawToken, ssoSecret, {
      algorithms: ['HS256'],
      clockTolerance: env.DENDREO_JWT_EXPIRY_TOLERANCE_SECONDS,
      maxAge: 300, // iat doit être <= 5 min
    }) as DendreoJwtPayload;
  } catch (err) {
    logger.warn('SSO JWT validation failed', { error: (err as Error).message });
    throw new UnauthorizedError('Token SSO invalide ou expiré');
  }

  // Replay protection (lecture seule ici — la marque vient ensuite, après la
  // résolution user/enrollment, pour ne pas brûler un JWT si la résolution échoue).
  if (payload.jti) {
    const existing = await prisma.usedJtiToken.findUnique({ where: { jti: payload.jti } });
    if (existing) {
      throw new UnauthorizedError('Token SSO déjà utilisé');
    }
  }

  return payload;
}

/**
 * Marque le jti comme consommé. À appeler une fois que tout le reste est OK
 * (user trouvé, enrollment trouvé, juste avant de générer le token de session).
 * Si le payload n'a pas de jti, no-op silencieux (Dendreo n'envoie pas toujours).
 */
export async function markDendreoTokenConsumed(payload: DendreoJwtPayload): Promise<void> {
  if (!payload.jti) return;
  const expiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + 24 * 3600 * 1000); // fallback 24h si pas d'exp
  try {
    await prisma.usedJtiToken.create({
      data: { jti: payload.jti, expiresAt },
    });
  } catch (err) {
    // Race possible si deux requêtes valident le même jti en parallèle :
    // une seule l'enregistrera, l'autre tombera sur l'unique constraint.
    // On log mais on ne bloque pas — la 2ème requête a vu le jti propre
    // au moment de validateDendreoToken donc l'entrée vient juste d'être créée.
    logger.warn('jti déjà consommé (race)', { jti: payload.jti, error: (err as Error).message });
  }
}

// ─── 2. Recherche user (lecture seule, pas de upsert) ────────────────────────

/**
 * Trouve le user pour le SSO. Cherche d'abord par `id` interne LMS
 * (= user_id dans la nouvelle spec), puis fallback par `dendreoUserId`
 * (= sub dans l'ancien format). Aucune écriture en DB.
 *
 * Effet de bord non bloquant : met à jour `lastSeenAt` en fire-and-forget.
 */
export async function findUserForSso(payload: DendreoJwtPayload): Promise<User> {
  const lookupId = extractUserId(payload);
  if (!lookupId) {
    throw new SsoUserNotFoundError('JWT sans user_id ni sub');
  }

  // Lookup primaire : id interne LMS
  let user = await prisma.user.findUnique({ where: { id: lookupId } });

  // Fallback : dendreoUserId (compat anciens JWT où sub = ID externe Dendreo)
  if (!user) {
    user = await prisma.user.findUnique({ where: { dendreoUserId: lookupId } });
  }

  if (!user) {
    throw new SsoUserNotFoundError(`id=${lookupId}`);
  }

  // Fire-and-forget : ne pas bloquer la réponse SSO si l'update échoue
  prisma.user
    .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    .catch((err) => logger.warn('lastSeenAt update failed', { userId: user.id, error: err.message }));

  return user;
}

// ─── 3. Recherche enrollment (lecture seule) ─────────────────────────────────

/**
 * Trouve l'enrollment du user pour la formation ciblée. Si plusieurs existent
 * (rare : ré-inscription), retourne le plus récent. Lecture seule.
 */
export async function findEnrollmentForSso(
  user: User,
  payload: DendreoJwtPayload,
): Promise<Enrollment> {
  const trainingId = extractTrainingId(payload);
  if (!trainingId) {
    throw new SsoEnrollmentNotFoundError('JWT sans training_id ni formation_id');
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: user.id, formationId: trainingId },
    orderBy: { createdAt: 'desc' },
  });

  if (!enrollment) {
    throw new SsoEnrollmentNotFoundError(`user=${user.id} formation=${trainingId}`);
  }

  return enrollment;
}

// ─── 4. JWT interne LMS ──────────────────────────────────────────────────────

/**
 * Génère un JWT interne LMS (HS256) pour la session apprenant.
 */
export function generateInternalJwt(user: User): string {
  const payload: AuthPayload = {
    userId: user.id,
    roles: user.roles,
    email: user.email,
  };

  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}
