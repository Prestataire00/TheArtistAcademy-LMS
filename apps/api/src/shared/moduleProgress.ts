import type { CompletionStatus, UAType } from '@prisma/client';

/**
 * Durées par défaut utilisées comme "poids" dans le calcul de progression
 * pondérée par durée (PRD §3.4). Valeurs arbitraires V1 — à rendre
 * paramétrables par UA dans une future version.
 */
export const DEFAULT_QUIZ_DURATION_SECONDS = 120;
export const DEFAULT_RESOURCE_DURATION_SECONDS = 60;
/** Fallback quand une UA vidéo n'a pas de `durationSeconds` connu en DB. */
export const DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS = 60;

export interface UAForProgress {
  status: CompletionStatus;
  type: UAType;
  /** `videoContent.durationSeconds` pour les UAs vidéo. Ignoré sinon. */
  videoDurationSeconds?: number | null;
}

export interface ModuleProgressResult {
  status: CompletionStatus;
  /** 0..100 entier arrondi (moyenne pondérée par durée). */
  progressPercent: number;
  totalUAs: number;
  completedUAs: number;
}

/**
 * Poids (en secondes) d'une UA pour la moyenne pondérée :
 * - vidéo    : `videoContent.durationSeconds` (fallback `DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS`)
 * - quiz     : `DEFAULT_QUIZ_DURATION_SECONDS`
 * - ressource: `DEFAULT_RESOURCE_DURATION_SECONDS`
 */
export function uaWeightSeconds(ua: { type: UAType; videoDurationSeconds?: number | null }): number {
  if (ua.type === 'video') {
    const d = ua.videoDurationSeconds;
    return d && d > 0 ? d : DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS;
  }
  if (ua.type === 'quiz') return DEFAULT_QUIZ_DURATION_SECONDS;
  return DEFAULT_RESOURCE_DURATION_SECONDS;
}

/**
 * Calcule le statut et le pourcentage d'avancement d'un module à partir des
 * UAs (statuts + types + durées) d'un apprenant.
 *
 * Convention partagée écran apprenant ↔ exports admin :
 *  - **Progression** : moyenne pondérée par durée
 *    `Σ(uaWeight × isCompleted) / Σ(uaWeight)` × 100, arrondie.
 *  - **Statut** : reste binaire et indépendant des poids
 *    `not_started` si 0 UA terminée, `completed` si toutes, `in_progress` sinon.
 *  - **Module vide** (aucune UA publiée) : progression 0%, statut `not_started`.
 */
export function computeModuleProgress(uas: UAForProgress[]): ModuleProgressResult {
  const totalUAs = uas.length;
  const completedUAs = uas.filter((u) => u.status === 'completed').length;

  let weightSum = 0;
  let completedWeightSum = 0;
  for (const ua of uas) {
    const w = uaWeightSeconds(ua);
    weightSum += w;
    if (ua.status === 'completed') completedWeightSum += w;
  }

  const progressPercent = weightSum > 0 ? Math.round((completedWeightSum / weightSum) * 100) : 0;
  const status: CompletionStatus =
    completedUAs === 0 ? 'not_started' :
    completedUAs >= totalUAs ? 'completed' :
    'in_progress';
  return { status, progressPercent, totalUAs, completedUAs };
}
