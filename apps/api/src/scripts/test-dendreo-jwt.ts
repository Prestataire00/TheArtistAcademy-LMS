/**
 * CLI — Génère un JWT Dendreo signé (HS256) et affiche l'URL SSO complète.
 *
 * Usage :
 *   tsx src/scripts/test-dendreo-jwt.ts \
 *     --secret <DENDREO_SIGNATURE_KEY> \
 *     --base http://localhost:3001 \
 *     --user_id <userId LMS> \
 *     --email marie@example.com \
 *     --formation_id <formationId> \
 *     --enrolment_id <enrolmentId>
 *
 * Affiche l'URL SSO à ouvrir dans un navigateur. Les valeurs manquantes ont
 * des défauts raisonnables pour debug local.
 */
import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

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
  const secret = args.secret ?? process.env.DENDREO_SIGNATURE_KEY ?? process.env.DENDREO_JWT_SECRET;

  if (!secret) {
    console.error('Erreur : aucun secret fourni (--secret ou DENDREO_SIGNATURE_KEY/DENDREO_JWT_SECRET).');
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: args.user_id ?? 'test-dendreo-user-id',
    email: args.email ?? 'marie@example.com',
    full_name: args.full_name ?? 'Marie Dupont',
    enrolment_id: args.enrolment_id ?? `test-enrolment-${Date.now()}`,
    formation_id: args.formation_id ?? 'test-formation-id',
    session_id: args.session_id,
    start_date: args.start_date ?? new Date(now * 1000 - 24 * 3600 * 1000).toISOString(),
    end_date: args.end_date ?? new Date(now * 1000 + 30 * 24 * 3600 * 1000).toISOString(),
    jti: args.jti ?? crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + 300, // 5 min
  };

  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
  const base = args.base ?? 'http://localhost:3001';
  const ssoUrl = `${base}/api/v1/auth/dendreo-sso?jwt=${encodeURIComponent(token)}`;

  console.log('JWT généré :');
  console.log(token);
  console.log('\nPayload :');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\nURL SSO à ouvrir dans un navigateur :');
  console.log(ssoUrl);
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
