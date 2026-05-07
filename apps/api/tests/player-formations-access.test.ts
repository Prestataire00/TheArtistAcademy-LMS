// Régression post-revert phase 2A : un user role='learner' avec un
// enrollment actif sur une formation doit pouvoir lire
// GET /api/v1/player/formations/:id (200), pas 403.
//
// Élargissement metier : admin/superadmin doivent aussi pouvoir lire la
// même route (bypass enrollment), pour la prévisualisation côté admin.
// Trainer : autorisé pour l'instant (le filtre par assignation viendra
// au chantier 2/3).
//
// Test mounté sur Express complet pour reproduire la stack telle qu'en
// prod (router-level requireRole + ordre de mounting).

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const TEST_JWT_SECRET = 'test-jwt-secret';

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

const FORMATION = {
  id: 'f1',
  title: 'Formation Test',
  description: null,
  thumbnailUrl: null,
  pathwayMode: 'free',
  videoCompletionThreshold: 99,
  modules: [],
};

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const ENROLLMENT_LEARNER_ACTIVE = {
  id: 'e1',
  userId: 'learner-1',
  formationId: FORMATION.id,
  status: 'active',
  startDate: new Date(NOW - 4 * DAY),
  endDate: new Date(NOW + 49 * DAY),
  createdAt: new Date(NOW - 4 * DAY),
};

jest.mock('../src/config/database', () => ({
  prisma: {
    enrollment: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        // Cas test : learner-1 inscrit, autres users pas inscrits
        if (where.userId === 'learner-1' && where.formationId === FORMATION.id) {
          return Promise.resolve(ENROLLMENT_LEARNER_ACTIVE);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'learner-1', email: 'l@t.fr', role: 'learner' }),
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

function tokenFor(role: string, userId = 'learner-1') {
  return jwt.sign(
    { userId, email: 'u@example.com', role },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('GET /api/v1/player/formations/:id — accès post-revert mono-rôle', () => {
  const app = buildApp();

  it("learner avec enrollment actif : 200 (régression revert phase 2A)", async () => {
    const res = await request(app)
      .get(`/api/v1/player/formations/${FORMATION.id}`)
      .set('Authorization', `Bearer ${tokenFor('learner', 'learner-1')}`);
    expect(res.status).toBe(200);
  });

  it("admin : 200 (bypass enrollment)", async () => {
    const res = await request(app)
      .get(`/api/v1/player/formations/${FORMATION.id}`)
      .set('Authorization', `Bearer ${tokenFor('admin', 'admin-1')}`);
    expect(res.status).toBe(200);
  });

  it("superadmin : 200 (bypass enrollment)", async () => {
    const res = await request(app)
      .get(`/api/v1/player/formations/${FORMATION.id}`)
      .set('Authorization', `Bearer ${tokenFor('superadmin', 'sa-1')}`);
    expect(res.status).toBe(200);
  });

  it("trainer : 200 (autorisé pour l'instant, filtre par assignation au chantier 2/3)", async () => {
    const res = await request(app)
      .get(`/api/v1/player/formations/${FORMATION.id}`)
      .set('Authorization', `Bearer ${tokenFor('trainer', 't-1')}`);
    expect(res.status).toBe(200);
  });

  it("token absent : 401 (pas 403)", async () => {
    const res = await request(app).get(`/api/v1/player/formations/${FORMATION.id}`);
    expect(res.status).toBe(401);
  });
});
