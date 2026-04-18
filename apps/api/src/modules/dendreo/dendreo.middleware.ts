import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors';

/**
 * Middleware de vérification HMAC-SHA256 pour les webhooks entrants Dendreo.
 * Le header 'Signature' contient le HMAC hex du body brut.
 */
export function verifyDendreoWebhookSignature(req: Request, _res: Response, next: NextFunction) {
  const signature = req.headers['signature'] as string;

  if (!signature) {
    throw new UnauthorizedError('Signature webhook manquante');
  }

  if (!env.DENDREO_WEBHOOK_SECRET) {
    throw new UnauthorizedError('Configuration webhook Dendreo manquante');
  }

  const rawBody = (req as any).rawBody as Buffer;
  if (!rawBody) {
    throw new UnauthorizedError('Corps de requête manquant pour vérification de signature');
  }

  const expected = crypto
    .createHmac('sha256', env.DENDREO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  );

  if (!valid) {
    throw new UnauthorizedError('Signature webhook invalide');
  }

  next();
}

/**
 * Middleware d'authentification par API key pour l'endpoint pull trainings.
 * Vérifie le header X-Auth-API-Key.
 */
export function verifyDendreoApiKey(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-auth-api-key'] as string;

  if (!apiKey || !env.DENDREO_API_KEY) {
    throw new UnauthorizedError('Clé API manquante');
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(apiKey),
    Buffer.from(env.DENDREO_API_KEY),
  );

  if (!valid) {
    throw new UnauthorizedError('Clé API invalide');
  }

  next();
}
