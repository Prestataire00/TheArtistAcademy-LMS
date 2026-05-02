import { prisma } from '../config/database';
import type { CompletionStatus } from '@prisma/client';

/**
 * Calcule, pour une formation, l'état verrouillé de chaque module et UA selon
 * le mode parcours :
 *   - free    : rien n'est verrouillé.
 *   - linear  : un module est verrouillé tant que tous les UAs du module
 *               précédent ne sont pas terminés. Au sein d'un module non
 *               verrouillé, l'UA N est verrouillée tant que l'UA N-1 n'est
 *               pas terminée. La 1ère UA d'un module non verrouillé est
 *               toujours accessible.
 *
 * Helper réutilisé entre la player service (sérialisation isLocked) et les
 * guards des routes UA (rejet 403 si verrouillée).
 */
export interface PathwayUA {
  id: string;
  position: number;
}

export interface PathwayModule {
  id: string;
  position: number;
  uas: PathwayUA[];
}

export interface PathwayLocks {
  moduleLocks: Map<string, boolean>;
  uaLocks: Map<string, boolean>;
}

export function computePathwayLocks(
  pathwayMode: 'linear' | 'free',
  modules: PathwayModule[],
  uaStatusByUaId: Map<string, CompletionStatus>,
): PathwayLocks {
  const moduleLocks = new Map<string, boolean>();
  const uaLocks = new Map<string, boolean>();

  const sortedModules = [...modules].sort((a, b) => a.position - b.position);

  for (let i = 0; i < sortedModules.length; i++) {
    const mod = sortedModules[i];

    let moduleLocked = false;
    if (pathwayMode === 'linear' && i > 0) {
      const prev = sortedModules[i - 1];
      moduleLocked = !prev.uas.every((u) => uaStatusByUaId.get(u.id) === 'completed');
    }
    moduleLocks.set(mod.id, moduleLocked);

    const sortedUAs = [...mod.uas].sort((a, b) => a.position - b.position);
    for (let j = 0; j < sortedUAs.length; j++) {
      const ua = sortedUAs[j];
      let uaLocked = moduleLocked;
      if (!uaLocked && pathwayMode === 'linear' && j > 0) {
        const prevUa = sortedUAs[j - 1];
        uaLocked = uaStatusByUaId.get(prevUa.id) !== 'completed';
      }
      uaLocks.set(ua.id, uaLocked);
    }
  }

  return { moduleLocks, uaLocks };
}

/**
 * Variante "à partir d'une UA" : charge la formation parente, ses modules/UAs
 * publiés, et les progressions de l'enrollment, puis renvoie l'état verrouillé
 * de l'UA cible. Utilisé par les guards.
 */
export async function isUALockedForEnrollment(
  uaId: string,
  enrollmentId: string,
  formationId: string,
  pathwayMode: 'linear' | 'free',
): Promise<boolean> {
  if (pathwayMode !== 'linear') return false;

  const [modules, uaProgresses] = await Promise.all([
    prisma.module.findMany({
      where: { formationId, isPublished: true },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        position: true,
        uas: {
          where: { isPublished: true },
          orderBy: { position: 'asc' },
          select: { id: true, position: true },
        },
      },
    }),
    prisma.uAProgress.findMany({
      where: { enrollmentId },
      select: { uaId: true, status: true },
    }),
  ]);

  const statusMap = new Map(uaProgresses.map((p) => [p.uaId, p.status]));
  const { uaLocks } = computePathwayLocks(pathwayMode, modules, statusMap);
  return uaLocks.get(uaId) ?? false;
}
