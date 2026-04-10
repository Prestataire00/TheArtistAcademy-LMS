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

  console.log('Seed terminé :');
  console.log(`  Formation : ${formation.id}`);
  console.log(`  Module    : ${module.id}`);
  console.log(`  UA video  : ${ua.id}`);
  console.log(`  UA quiz   : ${uaQuiz.id}`);
  console.log(`  User      : ${user.id} (${user.email})`);
  console.log(`  Enrollment: ${enrollment.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
