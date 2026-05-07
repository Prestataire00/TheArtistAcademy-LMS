// Phase 2A bis — chantier 3 : accès /formateur/* basé sur l'assignation
// (Formation.trainerId) et plus sur le rôle. Couvre :
//   - 403 si trainer/admin/superadmin sans aucune formation assignée
//   - 200 si admin assigné (même chose que trainer assigné)
//   - 403 si learner (filtré en amont par requireRole)
//   - Cross-trainer leak : trainer A ne voit pas la formation de B
//   - GET /auth/me/is-assigned-trainer renvoie true/false correctement

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
    RESEND_API_KEY: 're_stub_key_for_tests',
    RESEND_FROM: 'noreply@stub.fr',
    WEB_URL: 'https://stub.web',
  },
}));

// Stubs des dépendances externes initialisées à l'import :
// - Supabase (resources.service)
// - Resend (email.service via password-reset.controller)
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({}),
}));
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: null, error: null }) },
  })),
}));

jest.mock('../src/shared/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../src/shared/eventLog.service', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

// IDs : trainer-A assigné à formation X, admin-B assigné à formation Y,
// trainer-noassign sans assignation, learner sans assignation.
const TRAINER_A_ID = 'u-trainer-a';
const ADMIN_B_ID = 'u-admin-b';
const TRAINER_NOASSIGN_ID = 'u-trainer-noassign';
const ADMIN_NOASSIGN_ID = 'u-admin-noassign';
const LEARNER_ID = 'u-learner';

const FORMATION_X_ID = 'f-x';
const FORMATION_Y_ID = 'f-y';

// Mocks Prisma : configurés par test pour reproduire les scénarios.
const formationCount = jest.fn();
const formationFindFirst = jest.fn();
const formationFindMany = jest.fn();
const enrollmentFindMany = jest.fn();
const uaFindMany = jest.fn();
const quizAttemptFindMany = jest.fn();

jest.mock('../src/config/database', () => ({
  prisma: {
    formation: {
      count: (...args: unknown[]) => formationCount(...args),
      findFirst: (...args: unknown[]) => formationFindFirst(...args),
      findMany: (...args: unknown[]) => formationFindMany(...args),
    },
    enrollment: {
      findMany: (...args: unknown[]) => enrollmentFindMany(...args),
    },
    uA: {
      findMany: (...args: unknown[]) => uaFindMany(...args),
    },
    quizAttempt: {
      findMany: (...args: unknown[]) => quizAttemptFindMany(...args),
    },
  },
}));

import { formateurRouter } from '../src/modules/formateur/formateur.router';
import { authRouter } from '../src/modules/auth/auth.router';
import { errorHandler } from '../src/shared/errors';

function buildApp() {
  const app = express();
  app.use(express.json());
  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/formateur', formateurRouter);
  app.use('/api/v1', api);
  app.use(errorHandler);
  return app;
}

function tokenFor(userId: string, role: string) {
  return jwt.sign({ userId, email: `${userId}@taa.fr`, role }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

const app = buildApp();

beforeEach(() => {
  formationCount.mockReset();
  formationFindFirst.mockReset();
  formationFindMany.mockReset();
  enrollmentFindMany.mockReset();
  uaFindMany.mockReset();
  quizAttemptFindMany.mockReset();
});

// ─── Helper : configure les mocks pour un user assigné/non assigné ─────────────
function setupAssignment(userId: string, isAssigned: boolean) {
  formationCount.mockImplementation(({ where }: any) => {
    return Promise.resolve(where.trainerId === userId && isAssigned ? 1 : 0);
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('Accès /formateur/* — basé sur l\'assignation', () => {
  it("a) trainer assigné → 200 sur /formateur/sessions", async () => {
    setupAssignment(TRAINER_A_ID, true);
    formationFindMany.mockResolvedValue([]); // listSessions retourne []

    const res = await request(app)
      .get('/api/v1/formateur/sessions')
      .set('Authorization', `Bearer ${tokenFor(TRAINER_A_ID, 'trainer')}`);
    expect(res.status).toBe(200);
  });

  it("b) trainer non assigné → 403 avec message clair", async () => {
    setupAssignment(TRAINER_NOASSIGN_ID, false);

    const res = await request(app)
      .get('/api/v1/formateur/sessions')
      .set('Authorization', `Bearer ${tokenFor(TRAINER_NOASSIGN_ID, 'trainer')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toMatch(/n'êtes assigné à aucune formation/);
  });

  it("c) admin assigné → 200 sur /formateur/sessions (élargissement post-revert)", async () => {
    setupAssignment(ADMIN_B_ID, true);
    formationFindMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/formateur/sessions')
      .set('Authorization', `Bearer ${tokenFor(ADMIN_B_ID, 'admin')}`);
    expect(res.status).toBe(200);
  });

  it("d) admin non assigné → 403", async () => {
    setupAssignment(ADMIN_NOASSIGN_ID, false);

    const res = await request(app)
      .get('/api/v1/formateur/sessions')
      .set('Authorization', `Bearer ${tokenFor(ADMIN_NOASSIGN_ID, 'admin')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/n'êtes assigné à aucune formation/);
  });

  it("e) learner → 403 (filtré par requireRole en amont, garde-fou)", async () => {
    // Pas d'assignment lookup attendu : requireRole bloque avant
    const res = await request(app)
      .get('/api/v1/formateur/sessions')
      .set('Authorization', `Bearer ${tokenFor(LEARNER_ID, 'learner')}`);
    expect(res.status).toBe(403);
    // Message de requireRole, pas du middleware d'assignation
    expect(res.body.error.message).toMatch(/Permissions insuffisantes/);
    expect(formationCount).not.toHaveBeenCalled();
  });
});

describe('Cross-trainer isolation', () => {
  it("f) trainer A assigné à formation X reçoit 403 sur la formation Y d'un autre trainer", async () => {
    // Trainer A est assigné (passe le middleware), mais la formation Y
    // appartient à trainer B → requireFormationOwnership doit rejeter.
    setupAssignment(TRAINER_A_ID, true);
    formationFindFirst.mockImplementation(({ where }: any) => {
      // On simule la query "find formation where id=Y AND trainerId=A" → null
      if (where.id === FORMATION_Y_ID && where.trainerId === TRAINER_A_ID) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const res = await request(app)
      .get(`/api/v1/formateur/sessions/${FORMATION_Y_ID}/apprenants`)
      .set('Authorization', `Bearer ${tokenFor(TRAINER_A_ID, 'trainer')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/cette formation ne vous est pas assignée/i);
  });

  it("trainer A sur sa propre formation X → 200", async () => {
    setupAssignment(TRAINER_A_ID, true);
    formationFindFirst.mockResolvedValue({
      id: FORMATION_X_ID,
      title: 'Formation X',
      trainerId: TRAINER_A_ID,
    });
    enrollmentFindMany.mockResolvedValue([]);
    uaFindMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/v1/formateur/sessions/${FORMATION_X_ID}/apprenants`)
      .set('Authorization', `Bearer ${tokenFor(TRAINER_A_ID, 'trainer')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.formationId).toBe(FORMATION_X_ID);
  });
});

describe('GET /auth/me/is-assigned-trainer', () => {
  it("g) renvoie true pour un user avec ≥1 formation assignée", async () => {
    formationCount.mockImplementation(({ where }: any) => {
      expect(where.trainerId).toBe(TRAINER_A_ID);
      return Promise.resolve(2);
    });

    const res = await request(app)
      .get('/api/v1/auth/me/is-assigned-trainer')
      .set('Authorization', `Bearer ${tokenFor(TRAINER_A_ID, 'trainer')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isAssignedTrainer: true });
  });

  it("renvoie false pour un user sans aucune formation assignée", async () => {
    formationCount.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/auth/me/is-assigned-trainer')
      .set('Authorization', `Bearer ${tokenFor(ADMIN_NOASSIGN_ID, 'admin')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isAssignedTrainer: false });
  });

  it("renvoie 401 sans token", async () => {
    const res = await request(app).get('/api/v1/auth/me/is-assigned-trainer');
    expect(res.status).toBe(401);
  });
});
