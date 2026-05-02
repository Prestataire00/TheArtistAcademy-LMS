import * as jwt from 'jsonwebtoken';

const SECRET = process.env.DENDREO_JWT_SECRET;
const API_URL = process.env.SSO_TEST_API_URL || 'https://artist-academyapi-production.up.railway.app';
const WEB_URL = process.env.SSO_TEST_WEB_URL || 'https://artist-academyweb-production.up.railway.app';

if (!SECRET) {
  console.error('ERREUR : DENDREO_JWT_SECRET manquant dans l\'environnement');
  process.exit(1);
}

const payload = {
  firstname: 'EVA',
  lastname: 'TEST',
  user_id: 'cltest_eva_2252_1777720840.599098',
  email: 'test-eva-2252@example.com',
  iat: Math.floor(Date.now() / 1000),
  training_id: 'cmo3bnsy20000atc6xfgea8hm',
  enrolment_id: 'test-enrolment-2252-001',
};

const token = jwt.sign(payload, SECRET, { algorithm: 'HS256' });

const returnTo = `${WEB_URL}/formations/${payload.training_id}`;
const dendreoReturnTo = 'https://extranet-the-artist-academy-sandbox.dendreo.com';

const url = `${API_URL}/api/v1/auth/dendreo-sso`
  + `?jwt=${encodeURIComponent(token)}`
  + `&return_to=${encodeURIComponent(returnTo)}`
  + `&dendreo_return_to=${encodeURIComponent(dendreoReturnTo)}`;

console.log('\n=== Payload JWT ===\n');
console.log(JSON.stringify(payload, null, 2));
console.log('\n=== Token JWT ===\n');
console.log(token);
console.log('\n=== URL à ouvrir dans le navigateur ===\n');
console.log(url);
console.log('');