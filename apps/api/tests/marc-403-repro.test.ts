// Reproduction Marc — 403 sur GET /api/v1/player/formations/:id alors que :
//   - JWT mono-rôle valide : { userId, role: 'learner', email, iat, exp }
//   - Enrollment actif sur la formation, dans la fenêtre de dates
//   - Date système dans la fenêtre
//
// Le 403 reçu en prod a comme body :
//   { error: { code: "FORBIDDEN", message: "Permissions insuffisantes" } }
// signature exacte de requireRole.ts ligne 16 :
//   throw new ForbiddenError('Permissions insuffisantes');
//
// Ce test reproduit l'environnement de Marc le plus fidèlement possible
// (ses IDs, dates, rôle) pour vérifier si le bug est dans le code source
// local ou si la divergence vient du runtime Railway.

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const TEST_JWT_SECRET = 'test-jwt-secret';

// IDs réels de Marc (cf. bug report)
const MARC_USER_ID = 'cmots9v3x000a90vm0so4vqje';
const FORMATION_ID = 'cmo3bnsy20000atc6xfgea8hm';
const ENROLLMENT_ID = 'cmots9vgn000e90vm6ixxxuoe';

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret',
    JWT_EXPIRES_IN: '1h',
    DENDREO_SIGNATURE_KEY: 'k',
    DENDREO_WEBHOOK_SECRET: '',
    DENDREO_API_KEY: 'k',
    CORS_ORIGIN: '*',
    PORT: 0,
  },
}));

jest.mock('../src/shared/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

// Enrollment Marc : start_date 03/05/2026, end_date 25/06/2026.
// On utilise des dates relatives au "now" du runner pour rester dans la
// fenêtre quel que soit le jour où le test tourne.
const MARC_ENROLLMENT = {
  id: ENROLLMENT_ID,
  userId: MARC_USER_ID,
  formationId: FORMATION_ID,
  status: 'active',
  startDate: new Date(NOW - 4 * DAY),  // ~03/05 si on est le 07/05
  endDate: new Date(NOW + 49 * DAY),   // ~25/06 si on est le 07/05
  createdAt: new Date(NOW - 4 * DAY),
};

const FORMATION = {
  id: FORMATION_ID,
  title: 'Formation Test 1',
  description: null,
  thumbnailUrl: null,
  pathwayMode: 'free',
  videoCompletionThreshold: 99,
  modules: [],
};

jest.mock('../src/config/database', () => ({
  prisma: {
    enrollment: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        if (where.userId === MARC_USER_ID && where.formationId === FORMATION_ID) {
          return Promise.resolve(MARC_ENROLLMENT);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: MARC_USER_ID,
        email: 'eva.randrianasolo+marc@gmail.com',
        role: 'learner',
      }),
    },
    formation: {
      findUnique: jest.fn().mockResolvedValue(FORMATION),
    },
    uAProgress: { findMany: jest.fn().mockResolvedValue([]) },
    formationProgress: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

import { playerFormationsRouter } from '../src/modules/formations/formations.player.router';
import { errorHandler } from '../src/shared/errors';

function buildApp() {
  const app = express();
  app.use(express.json());
  const api = express.Router();
  api.use('/player', playerFormationsRouter);
  app.use('/api/v1', api);
  app.use(errorHandler);
  return app;
}

// JWT exactement comme celui de Marc en prod : payload mono-rôle
function marcJwt() {
  return jwt.sign(
    {
      userId: MARC_USER_ID,
      role: 'learner',
      email: 'eva.randrianasolo+marc@gmail.com',
    },
    TEST_JWT_SECRET,
    { expiresIn: '8h' },
  );
}

describe('Reproduction Marc — JWT mono-rôle valide + enrollment actif', () => {
  const app = buildApp();

  it("ne renvoie PAS 403 (pas de 'Permissions insuffisantes')", async () => {
    const res = await request(app)
      .get(`/api/v1/player/formations/${FORMATION_ID}`)
      .set('Authorization', `Bearer ${marcJwt()}`);

    // Garde-fou explicite contre la signature exacte de la 403 de Marc :
    expect(res.body?.error?.message).not.toBe('Permissions insuffisantes');
    expect(res.status).not.toBe(403);
  });

  it('renvoie 200 avec les données de la formation', async () => {
    const res = await request(app)
      .get(`/api/v1/player/formations/${FORMATION_ID}`)
      .set('Authorization', `Bearer ${marcJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body?.data?.formation?.id).toBe(FORMATION_ID);
    expect(res.body?.data?.enrollment?.id).toBe(ENROLLMENT_ID);
  });
});
