/**
 * CLI — Simule un webhook Dendreo signé HMAC-SHA256 et l'envoie à l'API.
 *
 * Usage :
 *   tsx src/scripts/test-dendreo-signature.ts \
 *     --url http://localhost:3001/api/v1/dendreo/users \
 *     --secret <DENDREO_SIGNATURE_KEY> \
 *     --body '{"event":"user.created","timestamp":"2026-04-25T12:00:00Z","tenant_id":"taa-formation","data":{"firstname":"Marie","lastname":"Dupont","email":"marie@example.com","password":"changeme123","tms_origin":"dendreo","external_id":"42"}}'
 *
 * Si --body est omis, un payload user.created par défaut est utilisé.
 */
import 'dotenv/config';
import crypto from 'crypto';

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

const DEFAULT_BODY = {
  event: 'user.created',
  timestamp: new Date().toISOString(),
  tenant_id: process.env.DENDREO_TENANT_ID || 'taa-formation',
  data: {
    firstname: 'Marie',
    lastname: 'Dupont',
    email: `test-${Date.now()}@example.com`,
    password: 'ChangeMe123',
    send_credentials: false,
    tms_origin: 'dendreo',
    external_id: `dendreo-${Date.now()}`,
  },
};

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url ?? 'http://localhost:3001/api/v1/dendreo/users';
  const secret = args.secret ?? process.env.DENDREO_SIGNATURE_KEY ?? process.env.DENDREO_WEBHOOK_SECRET;

  if (!secret) {
    console.error('Erreur : aucun secret fourni (--secret ou DENDREO_SIGNATURE_KEY/DENDREO_WEBHOOK_SECRET).');
    process.exit(1);
  }

  const body = args.body ?? JSON.stringify(DEFAULT_BODY);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  console.log('→ POST', url);
  console.log('  Signature:', signature);
  console.log('  Body:', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Signature: signature,
    },
    body,
  });

  const text = await res.text();
  console.log('← Status:', res.status);
  console.log('  Réponse:', text);
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
