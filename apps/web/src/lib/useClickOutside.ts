'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Appelle handler quand l'utilisateur clique en dehors des refs fournies
 * ou appuie sur Échap. Pratique pour fermer popovers et menus déroulants.
 *
 * Passe-toi `enabled=false` quand le composant est fermé pour éviter de
 * polluer le DOM avec des listeners inutiles.
 */
export function useClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      for (const ref of refs) {
        if (ref.current && ref.current.contains(target)) return;
      }
      handler();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handler();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [refs, handler, enabled]);
}
