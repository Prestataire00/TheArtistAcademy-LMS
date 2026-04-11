import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Formation
  const formation = await prisma.formation.create({
    data: {
      title: 'Formation Test',
      description: 'Formation de test pour la Phase 1',
      pathwayMode: 'free',
      videoCompletionThreshold: 99,
      isPublished: true,
    },
  });

  // 2. Module
  const module = await prisma.module.create({
    data: {
      formationId: formation.id,
      title: 'Module 1',
      position: 0,
      isPublished: true,
    },
  });

  // 3. UA vidéo
  const ua = await prisma.uA.create({
    data: {
      moduleId: module.id,
      title: 'Vidéo intro',
      type: 'video',
      position: 0,
      isPublished: true,
    },
  });

  // 4. User (upsert)
  const user = await prisma.user.upsert({
    where: { email: 'test@artistacademy.fr' },
    update: { lastSeenAt: now },
    create: {
      email: 'test@artistacademy.fr',
      fullName: 'Test Apprenant',
      role: 'learner',
      lastSeenAt: now,
    },
  });

  // 5. Enrollment actif
  const enrollment = await prisma.enrollment.create({
    data: {
      userId: user.id,
      formationId: formation.id,
      dendreoEnrolmentId: `seed_${Date.now()}`,
      startDate: now,
      endDate: in30Days,
      status: 'active',
    },
  });

  // 6. UA quiz
  const uaQuiz = await prisma.uA.create({
    data: {
      moduleId: module.id,
      title: 'Quiz de validation',
      type: 'quiz',
      position: 1,
      isPublished: true,
    },
  });

  // 7. Quiz avec questions
  const quiz = await prisma.quiz.create({
    data: { uaId: uaQuiz.id, title: 'Quiz de validation' },
  });

  const q1 = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, questionText: 'Quel est le mouvement artistique de Monet ?', type: 'mcq', position: 0, points: 2 },
  });
  await prisma.quizChoice.createMany({
    data: [
      { questionId: q1.id, choiceText: 'Cubisme', isCorrect: false },
      { questionId: q1.id, choiceText: 'Impressionnisme', isCorrect: true },
      { questionId: q1.id, choiceText: 'Surrealisme', isCorrect: false },
    ],
  });

  const q2 = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, questionText: 'Van Gogh etait neerlandais', type: 'truefalse', position: 1, points: 1 },
  });
  await prisma.quizChoice.createMany({
    data: [
      { questionId: q2.id, choiceText: 'Vrai', isCorrect: true },
      { questionId: q2.id, choiceText: 'Faux', isCorrect: false },
    ],
  });

  await prisma.quizQuestion.create({
    data: { quizId: quiz.id, questionText: 'Decrivez votre artiste prefere en quelques mots', type: 'short', position: 2, points: 1 },
  });

  // 8. UA resource + entrée Resource en base
  const uaResource = await prisma.uA.create({
    data: {
      moduleId: module.id,
      title: 'Guide pratique PDF',
      type: 'resource',
      position: 2,
      isPublished: true,
    },
  });

  const resource = await prisma.resource.create({
    data: {
      uaId: uaResource.id,
      fileName: 'Guide_pratique.pdf',
      fileUrl: 'resources/test.pdf',
      fileType: 'application/pdf',
      fileSizeBytes: 102400,
    },
  });

  // ─── 9. Apprenants supplementaires (alice + bob) ────────────────────────────

  // Formation Test Dispo (existante ou celle qu'on vient de creer)
  const formationDispo = await prisma.formation.findFirst({ where: { title: { contains: 'Formation Test Dispo' } } });
  const formationArtNum = await prisma.formation.findFirst({ where: { title: { contains: 'Art Numerique' } } });
  const targetFormationId = formationDispo?.id ?? formation.id;

  // Recuperer les UAs du module 1 de la formation cible
  const targetModule = await prisma.module.findFirst({
    where: { formationId: targetFormationId },
    orderBy: { position: 'asc' },
    include: { uas: { where: { isPublished: true }, orderBy: { position: 'asc' } } },
  });
  const targetUAs = targetModule?.uas ?? [];

  // Alice
  const alice = await prisma.user.upsert({
    where: { email: 'alice@test.fr' },
    update: { lastSeenAt: now },
    create: { email: 'alice@test.fr', fullName: 'Alice Martin', role: 'learner', lastSeenAt: now },
  });

  const aliceEnroll1 = await prisma.enrollment.create({
    data: {
      userId: alice.id, formationId: targetFormationId,
      dendreoEnrolmentId: `seed_alice1_${Date.now()}`,
      startDate: new Date(now.getTime() - 86400000), endDate: in30Days, status: 'active',
    },
  });

  // Alice sur Art Numerique aussi
  let aliceEnroll2 = null;
  if (formationArtNum) {
    aliceEnroll2 = await prisma.enrollment.create({
      data: {
        userId: alice.id, formationId: formationArtNum.id,
        dendreoEnrolmentId: `seed_alice2_${Date.now()}`,
        startDate: new Date(now.getTime() - 86400000), endDate: in30Days, status: 'active',
      },
    });
  }

  // Bob
  const bob = await prisma.user.upsert({
    where: { email: 'bob@test.fr' },
    update: { lastSeenAt: now },
    create: { email: 'bob@test.fr', fullName: 'Bob Dupont', role: 'learner', lastSeenAt: now },
  });

  const bobEnroll = await prisma.enrollment.create({
    data: {
      userId: bob.id, formationId: targetFormationId,
      dendreoEnrolmentId: `seed_bob_${Date.now()}`,
      startDate: new Date(now.getTime() - 86400000), endDate: in30Days, status: 'active',
    },
  });

  // ─── 10. Simuler progression ───────────────────────────────────────────────

  // Alice : 80% du module 1 (complete les 4 premieres UAs sur 5, ou toutes sauf la derniere)
  const aliceCompleteCount = Math.ceil(targetUAs.length * 0.8);
  for (let i = 0; i < targetUAs.length; i++) {
    const uaItem = targetUAs[i];
    const isCompleted = i < aliceCompleteCount;
    await prisma.uAProgress.upsert({
      where: { enrollmentId_uaId: { enrollmentId: aliceEnroll1.id, uaId: uaItem.id } },
      update: {},
      create: {
        enrollmentId: aliceEnroll1.id,
        uaId: uaItem.id,
        status: isCompleted ? 'completed' : 'in_progress',
        videoPositionSeconds: isCompleted ? 120 : 30,
        videoPercentWatched: isCompleted ? 100 : 25,
        timeSpentSeconds: isCompleted ? 300 : 60,
        firstAccessedAt: new Date(now.getTime() - 3600000),
        completedAt: isCompleted ? new Date(now.getTime() - 1800000) : null,
      },
    });
  }

  // Bob : 20% du module 1 (complete seulement la 1ere UA)
  const bobCompleteCount = Math.max(1, Math.ceil(targetUAs.length * 0.2));
  for (let i = 0; i < targetUAs.length; i++) {
    const uaItem = targetUAs[i];
    if (i < bobCompleteCount) {
      await prisma.uAProgress.upsert({
        where: { enrollmentId_uaId: { enrollmentId: bobEnroll.id, uaId: uaItem.id } },
        update: {},
        create: {
          enrollmentId: bobEnroll.id,
          uaId: uaItem.id,
          status: 'completed',
          videoPositionSeconds: 120,
          videoPercentWatched: 100,
          timeSpentSeconds: 180,
          firstAccessedAt: new Date(now.getTime() - 7200000),
          completedAt: new Date(now.getTime() - 7000000),
        },
      });
    }
  }

  console.log('Seed termine :');
  console.log(`  Formation  : ${formation.id}`);
  console.log(`  Module     : ${module.id}`);
  console.log(`  UA video   : ${ua.id}`);
  console.log(`  UA quiz    : ${uaQuiz.id}`);
  console.log(`  UA resource: ${uaResource.id}`);
  console.log(`  Resource   : ${resource.id}`);
  console.log(`  User       : ${user.id} (${user.email})`);
  console.log(`  Enrollment : ${enrollment.id}`);
  console.log();
  console.log(`  Alice      : ${alice.id} (${alice.email})`);
  console.log(`    Enroll 1 : ${aliceEnroll1.id} -> ${targetFormationId} (${aliceCompleteCount}/${targetUAs.length} UAs completed = ~80%)`);
  if (aliceEnroll2) console.log(`    Enroll 2 : ${aliceEnroll2.id} -> ${formationArtNum!.id} (Art Numerique)`);
  console.log(`  Bob        : ${bob.id} (${bob.email})`);
  console.log(`    Enroll   : ${bobEnroll.id} -> ${targetFormationId} (${bobCompleteCount}/${targetUAs.length} UAs completed = ~20%)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
