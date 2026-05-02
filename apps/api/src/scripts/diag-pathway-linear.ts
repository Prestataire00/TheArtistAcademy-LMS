/**
 * Diagnostic complet du verrouillage UA / module en mode linear,
 * de bout en bout (DB → service player → guard d'accès UA).
 *
 * Usage : tsx src/scripts/diag-pathway-linear.ts
 *
 * Étapes :
 *   1. Lit pathwayMode de "Art Numerique - Initiation" depuis la DB.
 *   2. Récupère l'apprenant Alice (alice@test.fr) et son enrollment actif
 *      sur cette formation. RAZ sa progression (UAProgress / ModuleProgress
 *      / FormationProgress / QuizAttempts) puis simule un nouvel apprenant.
 *   3. Appelle getPlayerFormation et inspecte le payload retourné — vérifie
 *      la présence de isLocked sur chaque UA et chaque module.
 *   4. Appelle verifyLearnerAccess (guard) pour la 1ère UA (devrait passer)
 *      puis pour la 2ème UA (devrait throw UALockedError).
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { getPlayerFormation } from '../modules/formations/formations.player.service';
import { verifyLearnerAccess } from '../shared/enrollment.guard';
import { UALockedError } from '../shared/errors';

const FORMATION_TITLE = 'Art Numerique - Initiation';
const LEARNER_EMAIL = 'alice@test.fr';

function section(title: string) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(title);
  console.log('─'.repeat(72));
}

async function main() {
  // ── Étape 1 : valeur en BDD ─────────────────────────────────────────────────
  section('1. Valeur DB pathwayMode');
  const formation = await prisma.formation.findFirst({
    where: { title: FORMATION_TITLE },
    select: { id: true, title: true, pathwayMode: true },
  });
  if (!formation) {
    console.error(`❌ Formation "${FORMATION_TITLE}" introuvable.`);
    process.exit(1);
  }
  console.log(`Formation       : ${formation.title} (id=${formation.id})`);
  console.log(`pathwayMode DB  : ${JSON.stringify(formation.pathwayMode)}  (typeof=${typeof formation.pathwayMode})`);
  if (formation.pathwayMode !== 'linear') {
    console.error(`❌ Attendu "linear", obtenu "${formation.pathwayMode}". Vérifier l'enum / le toggle admin.`);
    process.exit(1);
  }
  console.log('✅ pathwayMode = "linear" — cohérent avec l\'enum Prisma {linear, free}.');

  // Vérifie l'enum directement en lisant pg_enum
  const enumRows: Array<{ enumlabel: string }> = await prisma.$queryRaw`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PathwayMode')
    ORDER BY enumsortorder
  `;
  console.log(`Enum pg "PathwayMode" : [${enumRows.map((r) => r.enumlabel).join(', ')}]`);

  // ── Étape 2 : RAZ progression de l'apprenant ────────────────────────────────
  section('2. RAZ progression apprenant');
  const learner = await prisma.user.findUnique({ where: { email: LEARNER_EMAIL } });
  if (!learner) {
    console.error(`❌ Apprenant "${LEARNER_EMAIL}" introuvable.`);
    process.exit(1);
  }
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: learner.id, formationId: formation.id, status: 'active' },
  });
  if (!enrollment) {
    console.error(`❌ Pas d'enrollment actif pour ${LEARNER_EMAIL} sur "${formation.title}".`);
    process.exit(1);
  }
  console.log(`Apprenant       : ${learner.email} (id=${learner.id})`);
  console.log(`Enrollment      : ${enrollment.id}`);

  await prisma.$transaction([
    prisma.uAProgress.deleteMany({ where: { enrollmentId: enrollment.id } }),
    prisma.moduleProgress.deleteMany({ where: { enrollmentId: enrollment.id } }),
    prisma.quizAttempt.deleteMany({ where: { enrollmentId: enrollment.id } }),
    prisma.formationProgress.updateMany({
      where: { enrollmentId: enrollment.id },
      data: {
        status: 'not_started',
        progressPercent: 0,
        timeSpentSeconds: 0,
        firstAccessedAt: null,
        lastActivityAt: null,
        completedAt: null,
      },
    }),
  ]);
  console.log('✅ Progression remise à zéro.');

  // ── Étape 3 : payload getPlayerFormation ─────────────────────────────────────
  section('3. Payload GET /player/formations/:id');
  const payload = await getPlayerFormation(learner.id, formation.id);
  console.log(`pathwayMode dans payload  : ${payload.formation.pathwayMode}`);
  console.log(`continueUaId             : ${payload.continueUaId}`);
  console.log(`Modules :`);
  payload.modules.forEach((m, i) => {
    console.log(`  [${i + 1}] ${m.title}  isLocked=${m.isLocked}  status=${m.status}`);
    m.uas.forEach((u, j) => {
      const hasField = 'isLocked' in u;
      console.log(`      UA${j + 1}  ${u.title.padEnd(40)}  isLocked=${u.isLocked}  status=${u.status}  hasField=${hasField}`);
    });
  });

  const mod1 = payload.modules[0];
  const ua1 = mod1.uas[0];
  const ua2 = mod1.uas[1];

  let payloadOk = true;
  if (ua1.isLocked !== false) { console.error(`❌ UA1 devrait avoir isLocked=false`); payloadOk = false; }
  if (ua2.isLocked !== true)  { console.error(`❌ UA2 devrait avoir isLocked=true`); payloadOk = false; }
  if (mod1.isLocked !== false) { console.error(`❌ Module 1 devrait avoir isLocked=false`); payloadOk = false; }
  if (payload.modules.length > 1 && payload.modules[1].isLocked !== true) {
    console.error(`❌ Module 2 devrait avoir isLocked=true`); payloadOk = false;
  }
  if (payload.continueUaId !== ua1.id) {
    console.error(`❌ continueUaId devrait pointer sur UA1 (${ua1.id}), reçu ${payload.continueUaId}`); payloadOk = false;
  }
  if (payloadOk) console.log('✅ Payload conforme : isLocked correct sur UAs et modules.');

  // ── Étape 4 : guard backend ──────────────────────────────────────────────────
  section('4. Guard verifyLearnerAccess');

  console.log(`Tentative UA1 (${ua1.id}) — non verrouillée :`);
  let ua1Ok = false;
  try {
    await verifyLearnerAccess(learner.id, ua1.id);
    console.log('  ✅ UA1 accessible (pas d\'exception).');
    ua1Ok = true;
  } catch (err: any) {
    console.error(`  ❌ UA1 a levé une exception inattendue : ${err?.constructor?.name} — ${err.message}`);
  }

  console.log(`Tentative UA2 (${ua2.id}) — verrouillée :`);
  let ua2Ok = false;
  try {
    await verifyLearnerAccess(learner.id, ua2.id);
    console.error('  ❌ UA2 a été acceptée — le guard ne lit pas le verrou !');
  } catch (err: any) {
    if (err instanceof UALockedError) {
      console.log(`  ✅ UALockedError 403 levée (code=${err.code}, message="${err.message}").`);
      ua2Ok = true;
    } else {
      console.error(`  ❌ Exception inattendue : ${err?.constructor?.name} — ${err.message}`);
    }
  }

  // ── Conclusion ───────────────────────────────────────────────────────────────
  section('Conclusion');
  if (payloadOk && ua1Ok && ua2Ok) {
    console.log('✅ Bout en bout OK : DB, service player, guard cohérents.');
    process.exit(0);
  } else {
    console.log('❌ Au moins un maillon est cassé — voir détails ci-dessus.');
    process.exit(1);
  }
}

main()
  .catch((err) => { console.error('Erreur:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
