/**
 * Formatters partagés pour exports CSV admin.
 *
 * Conventions :
 * - Dates : JJ/MM/AAAA hh:mm (Europe/Paris). null/undefined → '-'.
 * - Durées : hh:mm:ss. null/0/négatif → '00:00:00'.
 * - Pourcentages : entrée décimale 0-1 ; sortie 'X%' arrondie. null/NaN → '-'.
 *   Les scores stockés en 0-100 doivent être divisés par 100 à l'appel.
 */

const DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
  hour12: false,
});

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  const time = date.getTime();
  if (Number.isNaN(time)) return '-';
  const parts = DATE_PARTS_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('day')}/${get('month')}/${get('year')} ${hour}:${get('minute')}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0 || Number.isNaN(seconds)) return '00:00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

/**
 * Convertit une valeur décimale (0-1) en entier de pourcentage (0-100) sous
 * forme de chaîne. Retourne une chaîne vide si null/undefined/NaN (cellule
 * vide dans Excel).
 *
 * **Pattern cible pour les nouveaux exports** : nom de colonne avec `(%)` à
 * la fin (ex: `'Progres (%)'`) + valeur entier brut sans signe `%`. Excel
 * peut alors traiter la valeur comme un nombre exploitable (filtres, formules,
 * Power BI, scripts Python) sans avoir à parser un `%` ou un `="84%"` quoted.
 *
 * Exemples : `0.84 → '84'` ; `0.846 → '85'` (arrondi) ; `1 → '100'` ;
 * `null → ''`.
 *
 * Note : les 4 exports historiques (Apprenants par session, Modules/UA, Logs,
 * Relances) continuent d'utiliser `formatPercent` (header `(%)` + cellule
 * `42%`). On ne les modifie pas pour éviter toute régression. Tout nouvel
 * export devrait suivre le pattern `percentInt`.
 */
export function percentInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return Math.round(value * 100).toString();
}
