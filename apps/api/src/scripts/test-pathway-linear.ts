/**
 * Test du verrouillage UA + module en mode parcours linéaire.
 *
 * Charge la formation 'Art Numerique - Initiation' (mode linear) depuis la DB
 * (lecture seule), puis exerce computePathwayLocks sur deux scénarios :
 *   - Apprenant à 0%  : seule la 1ère UA du module 1 doit être accessible.
 *   - UA 1 terminée  : la 2ème UA du module 1 doit se déverrouiller, les
 *                       autres UAs et modules suivants restent verrouillés.
 *
 * Usage : tsx src/scripts/test-pathway-linear.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { computePathwayLocks } from '../shared/pathway';
import type { CompletionStatus } from '@prisma/client';

const FORMATION_TITLE = 'Art Numerique - Initiation';

function fmt(label: string, ok: boolean, detail = '') {
  const status = ok ? '✅ OK' : '❌ FAIL';
  console.log(`  ${status}  ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  const formation = await prisma.formation.findFirst({
    where: { title: FORMATION_TITLE },
    include: {
      modules: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        include: {
          uas: {
            where: { isPublished: true },
            orderBy: { position: 'asc' },
            select: { id: true, title: true, position: true },
          },
        },
      },
    },
  });

  if (!formation) {
    console.error(`❌ Formation "${FORMATION_TITLE}" introuvable en DB.`);
    process.exit(1);
  }

  console.log(`\nFormation : ${formation.title} (id=${formation.id})`);
  console.log(`Mode parcours : ${formation.pathwayMode}`);
  console.log(`Modules publiés : ${formation.modules.length}`);
  formation.modules.forEach((m, i) => {
    console.log(`  Module ${i + 1} : ${m.title} (${m.uas.length} UAs)`);
  });
  console.log();

  if (formation.pathwayMode !== 'linear') {
    console.error('❌ La formation n\'est pas en mode linear — test non applicable.');
    process.exit(1);
  }

  if (formation.modules.length < 1 || formation.modules[0].uas.length < 2) {
    console.error('❌ La formation doit avoir au moins 1 module avec ≥ 2 UAs pour ce test.');
    process.exit(1);
  }

  const modulesForHelper = formation.modules.map((m) => ({
    id: m.id,
    position: m.position,
    uas: m.uas.map((u) => ({ id: u.id, position: u.position })),
  }));

  const mod1 = formation.modules[0];
  const ua1 = mod1.uas[0];
  const ua2 = mod1.uas[1];

  // ── Scénario 1 : apprenant à 0% ─────────────────────────────────────────────
  console.log('Scénario 1 : apprenant à 0% (aucune UA terminée)');
  let allPass = true;
  {
    const status = new Map<string, CompletionStatus>();
    const { moduleLocks, uaLocks } = computePathwayLocks('linear', modulesForHelper, status);

    allPass = fmt(`Module 1 non verrouillé`, moduleLocks.get(mod1.id) === false) && allPass;
    allPass = fmt(`UA 1 (${ua1.title}) non verrouillée`, uaLocks.get(ua1.id) === false) && allPass;
    allPass = fmt(`UA 2 (${ua2.title}) verrouillée`, uaLocks.get(ua2.id) === true) && allPass;
    for (let i = 2; i < mod1.uas.length; i++) {
      const ua = mod1.uas[i];
      allPass = fmt(`UA ${i + 1} (${ua.title}) verrouillée`, uaLocks.get(ua.id) === true) && allPass;
    }
    if (formation.modules.length > 1) {
      const mod2 = formation.modules[1];
      allPass = fmt(`Module 2 verrouillé`, moduleLocks.get(mod2.id) === true) && allPass;
      if (mod2.uas[0]) {
        allPass = fmt(`UA 1 du Module 2 verrouillée (héritage module locked)`,
          uaLocks.get(mod2.uas[0].id) === true) && allPass;
      }
    }
  }

  // ── Scénario 2 : UA 1 terminée ──────────────────────────────────────────────
  console.log('\nScénario 2 : UA 1 terminée');
  {
    const status = new Map<string, CompletionStatus>();
    status.set(ua1.id, 'completed');
    const { moduleLocks, uaLocks } = computePathwayLocks('linear', modulesForHelper, status);

    allPass = fmt(`Module 1 toujours non verrouillé`, moduleLocks.get(mod1.id) === false) && allPass;
    allPass = fmt(`UA 1 non verrouillée`, uaLocks.get(ua1.id) === false) && allPass;
    allPass = fmt(`UA 2 (${ua2.title}) DÉVERROUILLÉE`, uaLocks.get(ua2.id) === false) && allPass;
    if (mod1.uas.length > 2) {
      const ua3 = mod1.uas[2];
      allPass = fmt(`UA 3 (${ua3.title}) toujours verrouillée`, uaLocks.get(ua3.id) === true) && allPass;
    }
    if (formation.modules.length > 1) {
      const mod2 = formation.modules[1];
      allPass = fmt(`Module 2 toujours verrouillé (Module 1 pas encore terminé)`,
        moduleLocks.get(mod2.id) === true) && allPass;
    }
  }

  // ── Scénario 3 : toutes les UAs du module 1 terminées ──────────────────────
  if (formation.modules.length > 1) {
    console.log('\nScénario 3 : toutes les UAs du Module 1 terminées');
    const status = new Map<string, CompletionStatus>();
    mod1.uas.forEach((u) => status.set(u.id, 'completed'));
    const { moduleLocks, uaLocks } = computePathwayLocks('linear', modulesForHelper, status);

    const mod2 = formation.modules[1];
    allPass = fmt(`Module 2 DÉVERROUILLÉ`, moduleLocks.get(mod2.id) === false) && allPass;
    if (mod2.uas[0]) {
      allPass = fmt(`UA 1 du Module 2 accessible`, uaLocks.get(mod2.uas[0].id) === false) && allPass;
    }
    if (mod2.uas[1]) {
      allPass = fmt(`UA 2 du Module 2 verrouillée (UA 1 module 2 pas terminée)`,
        uaLocks.get(mod2.uas[1].id) === true) && allPass;
    }
  }

  console.log();
  if (allPass) {
    console.log('✅ Tous les tests sont passés.');
    process.exit(0);
  } else {
    console.log('❌ Certains tests ont échoué.');
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Erreur:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
