// Régression : sans hiérarchie linéaire, un user role='admin' qui hit
// GET /admin/dashboard/stats recevait 403 parce que `adminModulesRouter`
// (mounté sur `/admin` AVANT `adminRouter`, gardé par requireRole('trainer'))
// intercepte la requête. Son middleware router-level fire avant le matching
// de routes interne, donc même si la route /dashboard/stats n'existe pas
// dans adminModulesRouter, le 403 sort.
//
// On teste à travers la stack Express complète (mount path + router order)
// pour reproduire l'interaction qui causait le bug.

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
    SUPABASE_URL: 'https://stub.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'stub-key',
  },
}));

// adminVideosRouter -> videos.controller -> videos.service -> config/supabase
// crée un client Supabase à l'import. On stub createClient pour ne PAS toucher
// le réseau ni exiger une vraie URL/clé en environnement de test.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({}),
}));

jest.mock('../src/shared/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Stub des accès DB que getDashboardStats / listTrainers déclenchent.
// On retourne des collections vides : on teste l'autorisation, pas la donnée.
jest.mock('../src/config/database', () => ({
  prisma: {
    formation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    enrollment: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    uA: { findMany: jest.fn().mockResolvedValue([]) },
    quizAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    module: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'abc',
        formationId: 'f1',
        title: 'Stub Module',
        description: null,
        position: 0,
        isPublished: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        uas: [],
      }),
    },
  },
}));

import { adminFormationsRouter } from '../src/modules/formations/formations.router';
import { adminModulesRouter } from '../src/modules/modules/modules.router';
import { adminUAsRouter } from '../src/modules/uas/uas.router';
import { adminVideosRouter } from '../src/modules/videos/videos.router';
import { adminQuizzesRouter } from '../src/modules/quizzes/quizzes.router';
import { adminResourcesRouter } from '../src/modules/resources/resources.router';
import { adminRouter } from '../src/modules/admin/admin.router';
import { adminUsersRouter } from '../src/modules/admin/users.router';
import { errorHandler } from '../src/shared/errors';

// Réplique exactement le mounting de src/index.ts pour que le bug
// (router-level middleware d'un router /admin partagé qui fire en premier)
// soit reproduit.
function buildApp() {
  const app = express();
  app.use(express.json());
  const api = express.Router();

  // Ordre identique à src/index.ts pour que adminModulesRouter etc. soient
  // testés avant adminRouter — c'est la séquence qui exposait le bug.
  api.use('/admin/formations', adminFormationsRouter);
  api.use('/admin', adminModulesRouter);
  api.use('/admin', adminQuizzesRouter);
  api.use('/admin', adminResourcesRouter);
  api.use('/admin', adminVideosRouter);
  api.use('/admin', adminUAsRouter);
  api.use('/admin/utilisateurs', adminUsersRouter);
  api.use('/admin', adminRouter);

  app.use('/api/v1', api);
  app.use(errorHandler);
  return app;
}

function tokenFor(role: string) {
  return jwt.sign(
    { userId: 'u1', email: 'u@example.com', role },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('Régression admin routes — mono-rôle + mounting', () => {
  const app = buildApp();

  it("user role='admin' : GET /admin/dashboard/stats renvoie 200 (pas 403)", async () => {
    // Cas qui déclenchait le bug en prod : adminModulesRouter (gardé sur
    // 'trainer') interceptait avant que adminRouter (gardé sur 'admin') ne
    // voie la requête. Avec le fix, les guards content-management acceptent
    // explicitement admin/superadmin et la requête traverse jusqu'à la cible.
    const res = await request(app)
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(res.status).toBe(200);
  });

  it("user role='admin' : GET /admin/trainers renvoie 200 (pas 403)", async () => {
    const res = await request(app)
      .get('/api/v1/admin/trainers')
      .set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(res.status).toBe(200);
  });

  it("user role='superadmin' : GET /admin/dashboard/stats renvoie 200", async () => {
    // Sans hiérarchie automatique, les routers admin-only doivent lister
    // explicitement 'superadmin' à côté de 'admin'. Test garde-fou : un
    // superadmin doit traverser adminRouter (élargi à admin+superadmin).
    const res = await request(app)
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${tokenFor('superadmin')}`);
    expect(res.status).toBe(200);
  });

  it("user role='superadmin' : GET /admin/utilisateurs renvoie 200", async () => {
    // adminUsersRouter est aussi élargi à admin+superadmin.
    const res = await request(app)
      .get('/api/v1/admin/utilisateurs')
      .set('Authorization', `Bearer ${tokenFor('superadmin')}`);
    expect(res.status).toBe(200);
  });

  it("user role='trainer' : 403 sur /admin/dashboard/stats", async () => {
    // Garde-fou anti-élargissement : un trainer ne doit PAS pouvoir lire
    // le dashboard admin. Le fait qu'on ait élargi les guards
    // content-management ne doit pas ouvrir adminRouter.
    const res = await request(app)
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${tokenFor('trainer')}`);
    expect(res.status).toBe(403);
  });

  it("user role='trainer' : GET /admin/modules/abc traverse adminModulesRouter (pas 403)", async () => {
    // Le trainer reste autorisé sur les routers content-management après
    // l'élargissement (garde-fou anti-élargissement-excessif côté inverse :
    // on a ajouté admin/superadmin SANS retirer trainer).
    const res = await request(app)
      .get('/api/v1/admin/modules/abc')
      .set('Authorization', `Bearer ${tokenFor('trainer')}`);
    expect(res.status).toBe(200);
  });

  it("token absent : 401 Unauthorized (pas 403)", async () => {
    const res = await request(app).get('/api/v1/admin/dashboard/stats');
    expect(res.status).toBe(401);
  });
});
