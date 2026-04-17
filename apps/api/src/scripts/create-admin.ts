/**
 * CLI — Creer un compte admin ou formateur avec mot de passe.
 *
 * Usage :
 *   npx ts-node src/scripts/create-admin.ts --email admin@example.com --password secret123 --role admin --name "Admin Test"
 *
 * Options :
 *   --email     (requis) Adresse email
 *   --password  (requis) Mot de passe en clair (sera hashe en bcrypt)
 *   --role      admin | trainer (defaut: admin)
 *   --name      Nom complet (defaut: derive de l'email)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key && value) args[key] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.email || !args.password) {
    console.error('Usage: npx ts-node src/scripts/create-admin.ts --email <email> --password <password> [--role admin|trainer] [--name "Nom"]');
    process.exit(1);
  }

  const email = args.email;
  const password = args.password;
  const role = args.role === 'trainer' ? 'trainer' : 'admin';
  const fullName = args.name || email.split('@')[0];

  if (password.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caracteres.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, fullName, isActive: true },
    create: { email, passwordHash, fullName, role, isActive: true },
  });

  console.log(`Compte cree/mis a jour :`);
  console.log(`  ID    : ${user.id}`);
  console.log(`  Email : ${user.email}`);
  console.log(`  Role  : ${user.role}`);
  console.log(`  Nom   : ${user.fullName}`);
}

main()
  .catch((err) => {
    console.error('Erreur:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
