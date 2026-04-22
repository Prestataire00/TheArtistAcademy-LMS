'use client';

import { useEffect, useState } from 'react';

/**
 * True when viewport width >= minWidth (default 768px).
 * Used for pages whose mobile vs desktop layouts need different DOM trees
 * (e.g. dnd-kit can't bind useSortable to two nodes for the same id).
 */
export function useIsDesktop(minWidth = 768): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${minWidth}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [minWidth]);
  return isDesktop;
}
