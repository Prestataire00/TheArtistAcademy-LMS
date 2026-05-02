import { env } from '../../config/env';
import { logger } from '../../shared/logger';

export interface DendreoParticipant {
  id?: string;
  email?: string;
  prenom?: string;
  nom?: string;
  extranet_autologin_url?: string;
  extranet_code?: string;
  extranet_url?: string;
}

export async function fetchDendreoParticipant(
  externalId: string,
): Promise<DendreoParticipant | null> {
  if (!env.DENDREO_API_BASE_URL || !env.DENDREO_REST_API_KEY) {
    logger.warn('Dendreo API non configurée (DENDREO_API_BASE_URL ou DENDREO_REST_API_KEY manquant)');
    return null;
  }

  const url =
    `${env.DENDREO_API_BASE_URL.replace(/\/$/, '')}/participants.php` +
    `?key=${encodeURIComponent(env.DENDREO_REST_API_KEY)}` +
    `&id_participant=${encodeURIComponent(externalId)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(env.DENDREO_API_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn('Dendreo API: réponse non-OK', { status: res.status, externalId });
      return null;
    }

    const raw = (await res.json()) as DendreoParticipant | DendreoParticipant[];
    const data = Array.isArray(raw) ? raw[0] : raw;
    return data ?? null;
  } catch (error) {
    logger.error('Dendreo API: erreur fetch participant', {
      externalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
