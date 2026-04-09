import jwt from 'jsonwebtoken';
import { User, Enrollment } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { UnauthorizedError, BadRequestError } from '../../shared/errors';
import { AuthPayload } from '../../middleware/auth';
import { logger } from '../../shared/logger';

export interface DendreoJwtPayload {
  sub: string;           // dendreo_user_id
  email: string;
  full_name: string;
  enrolment_id: string;
  formation_id: string;
  session_id?: string;
  start_date: string;    // ISO date
  end_date: string;      // ISO date
  jti?: string;          // pour la protection replay
  iat: number;
  exp: number;
}

/**
 * Valide le JWT signé par Dendreo (RS256).
 * Vérifie la signature, l'expiration, et la protection replay via jti.
 */
export async function validateDendreoToken(rawToken: string): Promise<DendreoJwtPayload> {
  let payload: DendreoJwtPayload;

  try {
    payload = jwt.verify(rawToken, env.DENDREO_JWT_PUBLIC_KEY, {
      algorithms: [env.DENDREO_JWT_ALGORITHM as jwt.Algorithm],
      clockTolerance: env.DENDREO_JWT_EXPIRY_TOLERANCE_SECONDS,
    }) as DendreoJwtPayload;
  } catch (err) {
    logger.warn('SSO JWT validation failed', { error: (err as Error).message });
    throw new UnauthorizedError('Token SSO invalide ou expiré');
  }

  // Protection replay : rejeter un token jti déjà utilisé
  if (payload.jti) {
    const existing = await prisma.usedJtiToken.findUnique({ where: { jti: payload.jti } });
    if (existing) {
      throw new UnauthorizedError('Token SSO déjà utilisé');
    }
    await prisma.usedJtiToken.create({
      data: { jti: payload.jti, expiresAt: new Date(payload.exp * 1000) },
    });
  }

  return payload;
}

/**
 * Crée ou met à jour le User et l'Enrollment Dendreo sans doublons.
 */
export async function upsertUserAndEnrollment(
  payload: DendreoJwtPayload,
): Promise<{ user: User; enrollment: Enrollment }> {
  const startDate = new Date(payload.start_date);
  const endDate = new Date(payload.end_date);
  const now = new Date();

  const enrollmentStatus =
    now < startDate ? 'future' : now > endDate ? 'closed' : 'active';

  if (enrollmentStatus !== 'active') {
    throw new BadRequestError(
      enrollmentStatus === 'future'
        ? "Votre accès n'est pas encore ouvert"
        : 'Votre accès est terminé',
    );
  }

  // Upsert User
  const user = await prisma.user.upsert({
    where: { dendreoUserId: payload.sub },
    update: {
      email: payload.email,
      fullName: payload.full_name,
      lastSeenAt: now,
      isActive: true,
    },
    create: {
      dendreoUserId: payload.sub,
      email: payload.email,
      fullName: payload.full_name,
      role: 'learner',
      lastSeenAt: now,
    },
  });

  // Upsert Enrollment
  const enrollment = await prisma.enrollment.upsert({
    where: { dendreoEnrolmentId: payload.enrolment_id },
    update: {
      startDate,
      endDate,
      status: enrollmentStatus,
    },
    create: {
      userId: user.id,
      formationId: payload.formation_id,
      dendreoEnrolmentId: payload.enrolment_id,
      dendreoSessionId: payload.session_id,
      startDate,
      endDate,
      status: enrollmentStatus,
    },
  });

  return { user, enrollment };
}

/**
 * Génère un JWT interne LMS (HS256) pour la session apprenant.
 */
export function generateInternalJwt(user: User): string {
  const payload: AuthPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}
