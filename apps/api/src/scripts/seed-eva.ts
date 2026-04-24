import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

  // Formation Test Dispo (fallback : la plus récente formation avec "Test" dans le titre)
  const formation =
    (await prisma.formation.findFirst({ where: { title: { contains: 'Formation Test Dispo' } }, orderBy: { createdAt: 'desc' } })) ??
    (await prisma.formation.findFirst({ where: { title: { contains: 'Test' } }, orderBy: { createdAt: 'desc' } }));
  if (!formation) throw new Error('Aucune formation "Test" trouvee');
  console.log(`Formation ciblee : ${formation.title} (${formation.id})`);

  // Module 1 + UAs
  const module1 = await prisma.module.findFirst({
    where: { formationId: formation.id },
    orderBy: { position: 'asc' },
    include: { uas: { where: { isPublished: true }, orderBy: { position: 'asc' } } },
  });
  if (!module1) throw new Error('Module 1 introuvable dans Formation Test Dispo');

  const uas = module1.uas;

  // Eva Lambert
  const eva = await prisma.user.upsert({
    where: { email: 'eva.lambert@live.fr' },
    update: { lastSeenAt: now },
    create: { email: 'eva.lambert@live.fr', fullName: 'Eva Lambert', role: 'learner', lastSeenAt: now },
  });

  // Enrollment idempotent
  let enrollment = await prisma.enrollment.findFirst({
    where: { userId: eva.id, formationId: formation.id },
  });
  if (!enrollment) {
    enrollment = await prisma.enrollment.create({
      data: {
        userId: eva.id,
        formationId: formation.id,
        dendreoEnrolmentId: `seed_eva_${Date.now()}`,
        startDate: tenDaysAgo,
        endDate: in20Days,
        status: 'active',
      },
    });
  } else {
    enrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { startDate: tenDaysAgo, endDate: in20Days, status: 'active' },
    });
  }

  // 30% : premieres UAs completees + la suivante en cours
  const completeCount = Math.max(1, Math.ceil(uas.length * 0.3));
  for (let i = 0; i < uas.length; i++) {
    const ua = uas[i];
    const isCompleted = i < completeCount;
    const isInProgress = i === completeCount;
    if (!isCompleted && !isInProgress) continue;
    await prisma.uAProgress.upsert({
      where: { enrollmentId_uaId: { enrollmentId: enrollment.id, uaId: ua.id } },
      update: {},
      create: {
        enrollmentId: enrollment.id,
        uaId: ua.id,
        status: isCompleted ? 'completed' : 'in_progress',
        videoPositionSeconds: isCompleted ? 120 : 40,
        videoPercentWatched: isCompleted ? 100 : 35,
        timeSpentSeconds: isCompleted ? 240 : 60,
        firstAccessedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        completedAt: isCompleted ? new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) : null,
      },
    });
  }

  await prisma.moduleProgress.upsert({
    where: { enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId: module1.id } },
    update: { status: 'in_progress', progressPercent: 30 },
    create: {
      enrollmentId: enrollment.id,
      moduleId: module1.id,
      status: 'in_progress',
      progressPercent: 30,
      timeSpentSeconds: 360,
    },
  });

  console.log(JSON.stringify({
    userId: eva.id,
    email: eva.email,
    enrollmentId: enrollment.id,
    formationId: formation.id,
    moduleId: module1.id,
    uasCount: uas.length,
    completedCount: completeCount,
    startDate: enrollment.startDate.toISOString(),
    endDate: enrollment.endDate.toISOString(),
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
