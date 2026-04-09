/**
 * Formate un nombre de secondes en durée lisible (ex: "1h 23min" ou "45min")
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ''}`.trim();
  return `${m}min`;
}

/**
 * Formate une date ISO en date française
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Retourne le label de statut en français
 */
export function formatStatus(status: 'not_started' | 'in_progress' | 'completed'): string {
  const labels = {
    not_started: 'Non démarrée',
    in_progress: 'En cours',
    completed: 'Terminée',
  };
  return labels[status];
}
