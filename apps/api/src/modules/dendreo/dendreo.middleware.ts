import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors';
import { logger } from '../../shared/logger';

/**
 * Middleware de vérification HMAC-SHA256 pour les webhooks entrants Dendreo.
 * Le header 'Signature' contient le HMAC hex du body brut.
 */
export function verifyDendreoWebhookSignature(req: Request, _res: Response, next: NextFunction) {
  const signature = req.headers['signature'] as string;
  const tenantId = (req.body?.tenant_id as string) ?? 'unknown';
  const event = (req.body?.event as string) ?? 'unknown';

  if (!signature) {
    logger.warn('webhook.signature_missing', { tenantId, event });
    throw new UnauthorizedError('Signature webhook manquante');
  }

  // Préférer DENDREO_SIGNATURE_KEY (nouvelle var unifiée), fallback sur DENDREO_WEBHOOK_SECRET
  const webhookSecret = env.DENDREO_SIGNATURE_KEY || env.DENDREO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new UnauthorizedError('Configuration webhook Dendreo manquante');
  }

  const rawBody = (req as any).rawBody as Buffer;
  if (!rawBody) {
    throw new UnauthorizedError('Corps de requête manquant pour vérification de signature');
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Guard de longueur : `Buffer.from(hex)` tronque silencieusement les
  // caractères non-hex et `crypto.timingSafeEqual` lève une RangeError si les
  // longueurs des buffers diffèrent. Sans ce guard, une signature malformée
  // ou trop courte fait remonter une 500 INTERNAL_ERROR au lieu du 401 attendu.
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn('webhook.signature_invalid', { tenantId, event });
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

  // Même guard de longueur que pour les webhooks : si la clé reçue n'a pas
  // la même longueur que la clé attendue, `timingSafeEqual` lèverait une
  // RangeError → 500 au lieu de 401.
  const apiKeyBuf = Buffer.from(apiKey);
  const expectedBuf = Buffer.from(env.DENDREO_API_KEY);
  if (apiKeyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(apiKeyBuf, expectedBuf)) {
    logger.warn('api_key.invalid', { path: req.path });
    throw new UnauthorizedError('Clé API invalide');
  }

  next();
}
