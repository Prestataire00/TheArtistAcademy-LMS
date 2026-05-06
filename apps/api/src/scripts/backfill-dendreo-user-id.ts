/**
 * CLI — Backfill `User.dendreoUserId` à partir de `User.externalId` pour les
 * utilisateurs Dendreo existants en base.
 *
 * Pourquoi :
 *   Le webhook `user.created` ne remplissait pas la colonne `dendreoUserId`
 *   (cf. fix bug e — commit c8e83fc). Tous les apprenants créés avant ce
 *   fix ont donc `dendreoUserId = NULL` alors que leur `externalId` porte
 *   bien la valeur Dendreo. Ce script copie `externalId` vers `dendreoUserId`
 *   pour ramener la base à un état cohérent et débloquer le futur fix bug c
 *   (matching des webhooks user.created sur `dendreo_user_id`).
 *
 * Quand l'utiliser :
 *   - Une fois après le déploiement du fix bug e en sandbox.
 *   - Une fois après la bascule prod, pour les comptes éventuellement créés
 *     entre la première activation du connecteur et le déploiement du fix.
 *   - Idempotent : safe à relancer (filtre `dendreoUserId IS NULL`).
 *
 * Usage :
 *   tsx src/scripts/backfill-dendreo-user-id.ts --dry-run
 *   tsx src/scripts/backfill-dendreo-user-id.ts
 *
 * Comportement :
 *   - Sélectionne les users où tmsOrigin='dendreo' AND externalId IS NOT NULL
 *     AND dendreoUserId IS NULL.
 *   - Update un par un (pas updateMany) pour respecter la contrainte unique
 *     sur dendreoUserId et avoir un log par utilisateur.
 *   - Capture les erreurs par-ligne (typiquement P2002 unique constraint si
 *     un autre user porte déjà cette valeur) et continue.
 *   - --dry-run : affiche ce qui serait modifié sans rien écrire.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k?.startsWith('--')) continue;
    const v = argv[i + 1];
    if (v && !v.startsWith('--')) {
      out[k.slice(2)] = v;
      i++;
    } else {
      out[k.slice(2)] = 'true';
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = args['dry-run'] === 'true';

  const candidates = await prisma.user.findMany({
    where: {
      tmsOrigin: 'dendreo',
      externalId: { not: null },
      dendreoUserId: null,
    },
    select: { id: true, email: true, externalId: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nBackfill dendreoUserId — ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Candidats trouvés : ${candidates.length}\n`);

  if (candidates.length === 0) {
    console.log('✅ Rien à faire — base déjà cohérente.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of candidates) {
    if (!user.externalId) {
      // Ne devrait jamais arriver vu le filtre WHERE, mais on garde la
      // ceinture-bretelle pour TypeScript et pour anticiper une race.
      skipped++;
      continue;
    }

    const action = `${user.id} | ${user.email} | externalId=${user.externalId}`;

    if (dryRun) {
      console.log(`[dry-run] would update ${action}`);
      updated++;
      continue;
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { dendreoUserId: user.externalId },
      });
      console.log(`[ok]      updated      ${action}`);
      updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[error]   failed       ${action} — ${message}`);
      errors++;
    }
  }

  console.log(
    `\nBackfilled ${updated} users (${skipped} skipped, ${errors} errors)${
      dryRun ? ' [dry-run]' : ''
    }`,
  );
}

main()
  .catch((err) => {
    console.error('Erreur:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
