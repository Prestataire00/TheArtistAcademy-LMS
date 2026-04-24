import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ENROLLMENT_ID = 'cmo4fqoo30002ltzcbbdzeqkz';
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // Antidate uaProgresses + moduleProgresses via SQL brut (Prisma @updatedAt = auto)
  const uas = await prisma.$executeRaw`
    UPDATE "ua_progresses" SET "updated_at" = ${tenDaysAgo} WHERE "enrollment_id" = ${ENROLLMENT_ID}
  `;
  const mods = await prisma.$executeRaw`
    UPDATE "module_progresses" SET "updated_at" = ${tenDaysAgo} WHERE "enrollment_id" = ${ENROLLMENT_ID}
  `;

  console.log(`Antidate ${tenDaysAgo.toISOString()} applique :`);
  console.log(`  ua_progresses    : ${uas} lignes`);
  console.log(`  module_progresses: ${mods} lignes`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
