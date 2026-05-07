/**
 * CLI — Remet à zéro la progression d'un apprenant pour tester le mode
 * parcours linéaire (UA et module).
 *
 * Usage :
 *   tsx src/scripts/reset-learner.ts --email test@artistacademy.fr
 *   tsx src/scripts/reset-learner.ts --email alice@test.fr --formation <formationId>
 *
 * Comportement :
 *   - Cible toutes les inscriptions actives de l'apprenant (ou une seule
 *     formation si --formation est fourni).
 *   - Supprime UAProgress, ModuleProgress, QuizAttempt (cascade QuizAnswer).
 *   - Réinitialise FormationProgress : status='not_started', percent=0,
 *     timeSpent=0, firstAccessedAt/lastActivityAt/completedAt=null.
 *
 * Sécurité : refuse de tourner si NODE_ENV=production.
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
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ reset-learner refuse de tourner en NODE_ENV=production.');
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const email = args.email;
  const formationId = args.formation;

  if (!email) {
    console.error('❌ --email <email> requis.');
    console.error('   Usage : tsx src/scripts/reset-learner.ts --email <email> [--formation <id>]');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, role: true },
  });

  if (!user) {
    console.error(`❌ Apprenant introuvable pour email="${email}".`);
    process.exit(1);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: user.id,
      status: 'active',
      ...(formationId ? { formationId } : {}),
    },
    select: { id: true, formationId: true, formation: { select: { title: true } } },
  });

  if (enrollments.length === 0) {
    const scope = formationId ? ` pour la formation ${formationId}` : '';
    console.error(`❌ Aucune inscription active trouvée pour ${user.email}${scope}.`);
    process.exit(1);
  }

  const enrollmentIds = enrollments.map((e) => e.id);

  console.log(`\nReset progression — ${user.email} (${user.fullName ?? '?'})`);
  console.log(`Inscriptions ciblées : ${enrollments.length}`);
  enrollments.forEach((e) => {
    console.log(`  - ${e.formation.title} (enrollmentId=${e.id})`);
  });
  console.log();

  const result = await prisma.$transaction(async (tx) => {
    const uaDeleted = await tx.uAProgress.deleteMany({
      where: { enrollmentId: { in: enrollmentIds } },
    });

    const modDeleted = await tx.moduleProgress.deleteMany({
      where: { enrollmentId: { in: enrollmentIds } },
    });

    const quizDeleted = await tx.quizAttempt.deleteMany({
      where: { enrollmentId: { in: enrollmentIds } },
    });

    const formationProgressReset = await tx.formationProgress.updateMany({
      where: { enrollmentId: { in: enrollmentIds } },
      data: {
        status: 'not_started',
        progressPercent: 0,
        timeSpentSeconds: 0,
        firstAccessedAt: null,
        lastActivityAt: null,
        completedAt: null,
      },
    });

    return { uaDeleted, modDeleted, quizDeleted, formationProgressReset };
  });

  console.log('Résultat :');
  console.log(`  UAProgress supprimés       : ${result.uaDeleted.count}`);
  console.log(`  ModuleProgress supprimés   : ${result.modDeleted.count}`);
  console.log(`  QuizAttempts supprimées    : ${result.quizDeleted.count}`);
  console.log(`  FormationProgress remis    : ${result.formationProgressReset.count}`);
  console.log(`  Formations réinitialisées  : ${enrollments.length}`);
  console.log('\n✅ Reset terminé.');
}

main()
  .catch((err) => {
    console.error('Erreur:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
