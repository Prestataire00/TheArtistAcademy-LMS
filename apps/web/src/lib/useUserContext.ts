'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export type UserRole = 'learner' | 'trainer' | 'admin' | 'superadmin';

interface UserContext {
  role: UserRole | null;
  isAssignedTrainer: boolean;
}

// Cache module-scoped : la paire (rôle, assignation) est partagée entre les
// composants montés au cours de la même session. Évite de re-fetcher quand on
// navigue entre /admin et /formateur côté client.
let cached: UserContext | null = null;
let inflight: Promise<UserContext> | null = null;

async function fetchUserContext(): Promise<UserContext> {
  if (cached) return cached;
  if (inflight) return inflight;

  // /auth/me et /auth/me/is-assigned-trainer fonctionnent tous les deux via
  // cookie HttpOnly OU header Authorization (cf. apps/web/src/lib/api.ts qui
  // bascule selon la présence du token en localStorage). On NE décode PAS le
  // JWT côté client — il peut être HttpOnly (flux SSO) et donc invisible.
  inflight = Promise.all([
    api.get<{ user: { role?: UserRole } }>('/auth/me'),
    api.get<{ isAssignedTrainer: boolean }>('/auth/me/is-assigned-trainer'),
  ])
    .then(([me, assignment]) => {
      cached = {
        role: me.user?.role ?? null,
        isAssignedTrainer: assignment.isAssignedTrainer,
      };
      return cached;
    })
    .catch(() => {
      // Sur erreur (401/réseau), on tombe sur un contexte "non assigné, sans
      // rôle" → aucun bouton de bascule affiché. La vraie autorisation reste
      // côté serveur sur chaque requête métier.
      cached = { role: null, isAssignedTrainer: false };
      return cached;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

/**
 * Hook qui expose le rôle du user et son statut d'assignation comme formateur.
 * Source unique de vérité : appels API /auth/me + /auth/me/is-assigned-trainer.
 * Pas de décodage JWT côté client (le token peut être HttpOnly).
 *
 * Utilisé par les sidebars admin / formateur pour afficher conditionnellement
 * le bouton de bascule entre les deux espaces.
 */
export function useUserContext() {
  const [state, setState] = useState<UserContext | null>(cached);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) {
      setState(cached);
      setIsLoading(false);
      return;
    }
    let mounted = true;
    fetchUserContext().then((value) => {
      if (mounted) {
        setState(value);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  return {
    role: state?.role ?? null,
    isAssignedTrainer: state?.isAssignedTrainer ?? null,
    isLoading,
  };
}
