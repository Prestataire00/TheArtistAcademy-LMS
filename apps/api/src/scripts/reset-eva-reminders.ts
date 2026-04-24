import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const eva = await prisma.user.findUnique({ where: { email: 'eva.lambert@live.fr' } });
  if (!eva) throw new Error('Eva Lambert introuvable');

  // Supprime les ReminderLog d'Eva
  const deletedLogs = await prisma.reminderLog.deleteMany({ where: { userId: eva.id } });

  // Antidate sa progression pour qu'elle reste eligible au filtre "stalled 7j"
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const enrollments = await prisma.enrollment.findMany({ where: { userId: eva.id }, select: { id: true } });
  const enrollmentIds = enrollments.map((e) => e.id);

  let uaUpdated = 0;
  let modUpdated = 0;
  if (enrollmentIds.length > 0) {
    uaUpdated = await prisma.$executeRaw`
      UPDATE "ua_progresses" SET "updated_at" = ${tenDaysAgo} WHERE "enrollment_id" = ANY(${enrollmentIds})
    `;
    modUpdated = await prisma.$executeRaw`
      UPDATE "module_progresses" SET "updated_at" = ${tenDaysAgo} WHERE "enrollment_id" = ANY(${enrollmentIds})
    `;
  }

  console.log(`Eva reset :`);
  console.log(`  ReminderLogs supprimes : ${deletedLogs.count}`);
  console.log(`  ua_progresses antidatees (${tenDaysAgo.toISOString()}) : ${uaUpdated}`);
  console.log(`  module_progresses antidatees : ${modUpdated}`);
  console.log(`  Enrollments : ${enrollmentIds.join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
