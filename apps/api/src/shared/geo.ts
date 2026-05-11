import geoip from 'geoip-lite';

/**
 * Résout le code pays ISO 3166-1 alpha-2 (ex: 'FR', 'BE') d'une adresse IP
 * via la base GeoLite2 embarquée par geoip-lite (offline, gratuite).
 *
 * Retourne null si :
 *  - l'IP est null/undefined/vide,
 *  - l'IP n'est pas géolocalisée (réseau privé, IP réservée, etc.).
 */
export function lookupCountry(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return geoip.lookup(ip)?.country ?? null;
}
