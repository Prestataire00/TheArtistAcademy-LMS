// Phase 2A bis — chantier 2 : assignation d'un formateur principal à
// une formation. Couvre :
//   - GET /admin/formations/available-trainers (admin + trainer, pas
//     learner ni superadmin)
//   - PUT /admin/formations/:id avec trainerId valide (admin/trainer),
//     invalide (learner), ou null (désassignation)
//   - GET /admin/formations/:id renvoie trainer peuplé
//   - GET /admin/formations renvoie trainerName / trainerId

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

jest.mock('../src/shared/eventLog.service', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

// ─── Données de test ─────────────────────────────────────────────────────────

const ADMIN_USER = { id: 'u-admin', fullName: 'Eva Randrianasolo', email: 'eva@taa.fr', role: 'admin', isActive: true };
const TRAINER_USER = { id: 'u-trainer', fullName: 'Pierre Dupont', email: 'pierre@taa.fr', role: 'trainer', isActive: true };
const LEARNER_USER = { id: 'u-learner', fullName: 'Marc Apprenant', email: 'marc@taa.fr', role: 'learner', isActive: true };
const SUPERADMIN_USER = { id: 'u-sa', fullName: 'Super Admin', email: 'sa@taa.fr', role: 'superadmin', isActive: true };

const FORMATION_NO_TRAINER = {
  id: 'f1',
  title: 'Formation sans formateur',
  description: null,
  thumbnailUrl: null,
  pathwayMode: 'free',
  videoCompletionThreshold: 99,
  isPublished: false,
  trainerId: null,
  createdAt: new Date('2026-04-15T00:00:00Z'),
  updatedAt: new Date('2026-04-15T00:00:00Z'),
};

const FORMATION_WITH_TRAINER = {
  ...FORMATION_NO_TRAINER,
  id: 'f2',
  title: 'Formation avec trainer',
  trainerId: TRAINER_USER.id,
  trainer: { id: TRAINER_USER.id, fullName: TRAINER_USER.fullName, email: TRAINER_USER.email, role: TRAINER_USER.role },
  modules: [],
  _count: { modules: 0, enrollments: 0 },
};

// Mock prisma : les méthodes sont configurables par test via le helper.
const prismaUserFindMany = jest.fn();
const prismaUserFindUnique = jest.fn();
const prismaFormationFindMany = jest.fn();
const prismaFormationFindUnique = jest.fn();
const prismaFormationUpdate = jest.fn();

jest.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => prismaUserFindMany(...args),
      findUnique: (...args: unknown[]) => prismaUserFindUnique(...args),
    },
    formation: {
      findMany: (...args: unknown[]) => prismaFormationFindMany(...args),
      findUnique: (...args: unknown[]) => prismaFormationFindUnique(...args),
      update: (...args: unknown[]) => prismaFormationUpdate(...args),
    },
  },
}));

import { adminFormationsRouter } from '../src/modules/formations/formations.router';
import { errorHandler } from '../src/shared/errors';

function buildApp() {
  const app = express();
  app.use(express.json());
  const api = express.Router();
  api.use('/admin/formations', adminFormationsRouter);
  app.use('/api/v1', api);
  app.use(errorHandler);
  return app;
}

function adminToken() {
  return jwt.sign(
    { userId: ADMIN_USER.id, email: ADMIN_USER.email, role: 'admin' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const app = buildApp();

beforeEach(() => {
  prismaUserFindMany.mockReset();
  prismaUserFindUnique.mockReset();
  prismaFormationFindMany.mockReset();
  prismaFormationFindUnique.mockReset();
  prismaFormationUpdate.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /admin/formations/available-trainers', () => {
  it('renvoie uniquement les users admin + trainer (pas learner, pas superadmin)', async () => {
    prismaUserFindMany.mockImplementation(({ where }: any) => {
      // Le service filtre où role IN ['admin', 'trainer']. On vérifie
      // que la requête arrive avec le bon filtre, et on ne retourne
      // que les users qui matcheraient ce filtre.
      expect(where.role.in).toEqual(['admin', 'trainer']);
      expect(where.isActive).toBe(true);
      return Promise.resolve([
        { id: ADMIN_USER.id, fullName: ADMIN_USER.fullName, email: ADMIN_USER.email, role: 'admin' },
        { id: TRAINER_USER.id, fullName: TRAINER_USER.fullName, email: TRAINER_USER.email, role: 'trainer' },
      ]);
    });

    const res = await request(app)
      .get('/api/v1/admin/formations/available-trainers')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((u: any) => u.role).sort()).toEqual(['admin', 'trainer']);
    // Garde-fou : pas de learner ni superadmin dans la réponse
    expect(res.body.data.some((u: any) => u.role === 'learner')).toBe(false);
    expect(res.body.data.some((u: any) => u.role === 'superadmin')).toBe(false);
  });
});

describe('PUT /admin/formations/:id — validation trainerId', () => {
  it('accepte un trainerId pointant vers un user role=admin', async () => {
    prismaFormationFindUnique.mockResolvedValue(FORMATION_NO_TRAINER);
    prismaUserFindUnique.mockResolvedValue({ id: ADMIN_USER.id, role: 'admin', isActive: true });
    prismaFormationUpdate.mockResolvedValue({ ...FORMATION_NO_TRAINER, trainerId: ADMIN_USER.id });

    const res = await request(app)
      .put(`/api/v1/admin/formations/${FORMATION_NO_TRAINER.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ trainerId: ADMIN_USER.id });

    expect(res.status).toBe(200);
    expect(res.body.data.trainerId).toBe(ADMIN_USER.id);
    expect(prismaFormationUpdate).toHaveBeenCalledTimes(1);
  });

  it('accepte un trainerId pointant vers un user role=trainer', async () => {
    prismaFormationFindUnique.mockResolvedValue(FORMATION_NO_TRAINER);
    prismaUserFindUnique.mockResolvedValue({ id: TRAINER_USER.id, role: 'trainer', isActive: true });
    prismaFormationUpdate.mockResolvedValue({ ...FORMATION_NO_TRAINER, trainerId: TRAINER_USER.id });

    const res = await request(app)
      .put(`/api/v1/admin/formations/${FORMATION_NO_TRAINER.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ trainerId: TRAINER_USER.id });

    expect(res.status).toBe(200);
    expect(prismaFormationUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejette en 400 un trainerId pointant vers un user role=learner', async () => {
    prismaFormationFindUnique.mockResolvedValue(FORMATION_NO_TRAINER);
    prismaUserFindUnique.mockResolvedValue({ id: LEARNER_USER.id, role: 'learner', isActive: true });

    const res = await request(app)
      .put(`/api/v1/admin/formations/${FORMATION_NO_TRAINER.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ trainerId: LEARNER_USER.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toMatch(/learner/i);
    // Garde-fou : on n'a PAS appelé update si la validation échoue
    expect(prismaFormationUpdate).not.toHaveBeenCalled();
  });

  it('rejette en 400 un trainerId pointant vers un user superadmin', async () => {
    prismaFormationFindUnique.mockResolvedValue(FORMATION_NO_TRAINER);
    prismaUserFindUnique.mockResolvedValue({ id: SUPERADMIN_USER.id, role: 'superadmin', isActive: true });

    const res = await request(app)
      .put(`/api/v1/admin/formations/${FORMATION_NO_TRAINER.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ trainerId: SUPERADMIN_USER.id });

    expect(res.status).toBe(400);
    expect(prismaFormationUpdate).not.toHaveBeenCalled();
  });

  it('accepte trainerId: null (désassignation, pas de lookup user)', async () => {
    prismaFormationFindUnique.mockResolvedValue(FORMATION_NO_TRAINER);
    prismaFormationUpdate.mockResolvedValue({ ...FORMATION_NO_TRAINER, trainerId: null });

    const res = await request(app)
      .put(`/api/v1/admin/formations/${FORMATION_NO_TRAINER.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ trainerId: null });

    expect(res.status).toBe(200);
    expect(prismaFormationUpdate).toHaveBeenCalledTimes(1);
    // On ne doit PAS avoir cherché un user — c'est une désassignation
    expect(prismaUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('GET /admin/formations/:id — trainer peuplé', () => {
  it('inclut un objet trainer dans la réponse quand un trainer est assigné', async () => {
    prismaFormationFindUnique.mockResolvedValue({
      ...FORMATION_WITH_TRAINER,
      modules: [],
    });

    const res = await request(app)
      .get(`/api/v1/admin/formations/${FORMATION_WITH_TRAINER.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainerId).toBe(TRAINER_USER.id);
    expect(res.body.data.trainer).toMatchObject({
      id: TRAINER_USER.id,
      fullName: TRAINER_USER.fullName,
      email: TRAINER_USER.email,
      role: 'trainer',
    });
  });
});

describe('GET /admin/formations — trainerName dans la liste', () => {
  it('inclut trainerId et trainerName pour chaque formation', async () => {
    prismaFormationFindMany.mockResolvedValue([
      {
        ...FORMATION_NO_TRAINER,
        _count: { modules: 0, enrollments: 0 },
        trainer: null,
      },
      {
        ...FORMATION_WITH_TRAINER,
        _count: { modules: 0, enrollments: 0 },
        trainer: { id: TRAINER_USER.id, fullName: TRAINER_USER.fullName, email: TRAINER_USER.email },
      },
    ]);

    const res = await request(app)
      .get('/api/v1/admin/formations')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].trainerId).toBeNull();
    expect(res.body.data[0].trainerName).toBeNull();
    expect(res.body.data[1].trainerId).toBe(TRAINER_USER.id);
    expect(res.body.data[1].trainerName).toBe(TRAINER_USER.fullName);
  });
});
