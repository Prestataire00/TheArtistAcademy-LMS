/**
 * Normalise une chaîne pour comparaison de recherche : trim, lowercase,
 * suppression des diacritiques (é → e, ç → c…). Utilisé côté input ET
 * côté champs cibles pour que la recherche soit insensible à la casse
 * et aux accents.
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * True si chaque token (mot) de `query` est présent en substring dans au
 * moins un des `targets` (après normalisation). Permet "marie dupont" de
 * matcher "Marie Dupont" ou un email "marie.dupont@…".
 *
 * Si la query est vide après normalisation, retourne true (pas de filtre).
 */
export function matchesSearch(query: string, targets: string[]): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;

  const normalizedTargets = targets.map(normalizeForSearch);
  const tokens = q.split(/\s+/).filter(Boolean);

  return tokens.every((token) =>
    normalizedTargets.some((t) => t.includes(token)),
  );
}
