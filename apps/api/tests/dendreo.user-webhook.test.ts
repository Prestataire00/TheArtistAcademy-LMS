// Tests du handler user.created.
//
// Couvre :
//   - bug e (option A) : `dendreoUserId` ET `externalId` remplis quand
//     tms_origin='dendreo' et external_id présent.
//   - bug c (stratégie C) : matching par dendreoUserId d'abord, puis
//     email avec garde-fou collision (création séparée + EventLog
//     dendreo.collision, user existant intact).

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    DENDREO_SIGNATURE_KEY: 'test-signature-key',
    DENDREO_WEBHOOK_SECRET: '',
    DENDREO_API_KEY: 'test-api-key',
  },
}));

jest.mock('../src/shared/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const logEventMock = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/shared/eventLog.service', () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

jest.mock('../src/modules/dendreo/dendreo.progression.service', () => ({
  sendProgressionToDendreo: jest.fn(),
}));

jest.mock('../src/modules/dendreo/dendreo.api.client', () => ({
  fetchDendreoParticipant: jest.fn(),
}));

const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const createMock = jest.fn();
jest.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { handleUserWebhook } from '../src/modules/dendreo/dendreo.webhooks.service';

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  createMock.mockReset();
  logEventMock.mockReset();
  logEventMock.mockResolvedValue(undefined);
});

describe('handleUserWebhook — Cas 1 : match par dendreoUserId', () => {
  it('updates the matched user and creates no new one', async () => {
    findUniqueMock.mockImplementation(({ where }) => {
      if (where.dendreoUserId === '2252') {
        return Promise.resolve({
          id: 'user-existing',
          email: 'old@example.com',
          dendreoUserId: '2252',
          externalId: '2252',
        });
      }
      return Promise.resolve(null);
    });
    updateMock.mockResolvedValue({ id: 'user-existing' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 2252,
        tms_origin: 'dendreo',
      },
    });

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { dendreoUserId: '2252' } });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();

    const updateArg = updateMock.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'user-existing' });
    expect(updateArg.data.fullName).toBe('EVA TEST');
    expect(updateArg.data.externalId).toBe('2252'); // bug e regression
    expect(updateArg.data.tmsOrigin).toBe('dendreo');
    expect(updateArg.data.isActive).toBe(true);
    expect(updateArg.data).not.toHaveProperty('role');
    expect(updateArg.data).not.toHaveProperty('passwordHash');
  });
});

describe('handleUserWebhook — Cas 2a : match par email (rattachement)', () => {
  it('attaches dendreoUserId and externalId to a user that has none', async () => {
    findUniqueMock.mockImplementation(({ where }) => {
      if (where.dendreoUserId) return Promise.resolve(null);
      if (where.email === 'eva@example.com') {
        return Promise.resolve({
          id: 'user-no-bridge',
          email: 'eva@example.com',
          dendreoUserId: null,
          externalId: null,
        });
      }
      return Promise.resolve(null);
    });
    updateMock.mockResolvedValue({ id: 'user-no-bridge' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 2252,
        tms_origin: 'dendreo',
      },
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();

    const updateArg = updateMock.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'user-no-bridge' });
    expect(updateArg.data.fullName).toBe('EVA TEST');
    expect(updateArg.data.dendreoUserId).toBe('2252');
    expect(updateArg.data.externalId).toBe('2252');
    expect(updateArg.data).not.toHaveProperty('role');
    expect(updateArg.data).not.toHaveProperty('passwordHash');
  });
});

describe('handleUserWebhook — Cas 2b : collision', () => {
  it('creates a new user with placeholder email and does NOT modify the existing user', async () => {
    findUniqueMock.mockImplementation(({ where }) => {
      if (where.dendreoUserId === '2252') return Promise.resolve(null);
      if (where.email === 'eva.randrianasolo@gmail.com') {
        return Promise.resolve({
          id: 'user-admin',
          email: 'eva.randrianasolo@gmail.com',
          dendreoUserId: '999',
          externalId: '999',
          role: 'admin',
          passwordHash: 'admin-hash',
        });
      }
      return Promise.resolve(null);
    });
    createMock.mockResolvedValue({ id: 'user-collision' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'PARTICIPANT',
        lastname: 'EVA',
        email: 'eva.randrianasolo@gmail.com',
        external_id: 2252,
        tms_origin: 'dendreo',
      },
    });

    // User existant n'est PAS touché
    expect(updateMock).not.toHaveBeenCalled();

    // Nouveau user créé avec email placeholder
    expect(createMock).toHaveBeenCalledTimes(1);
    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data.email).toBe('dendreo-2252@no-email.local');
    expect(createArg.data.fullName).toBe('PARTICIPANT EVA');
    expect(createArg.data.dendreoUserId).toBe('2252');
    expect(createArg.data.externalId).toBe('2252');
    expect(createArg.data.role).toBe('learner');
    expect(createArg.data.isActive).toBe(true);
    expect(createArg.data).not.toHaveProperty('passwordHash');

    // EventLog dendreo.collision écrit avec tous les champs
    const collisionLog = logEventMock.mock.calls.find(
      (call) => call[0].action === 'dendreo.collision'
    );
    expect(collisionLog).toBeDefined();
    expect(collisionLog![0].category).toBe('webhook');
    expect(collisionLog![0].payload.originalEmail).toBe('eva.randrianasolo@gmail.com');
    expect(collisionLog![0].payload.existingUserId).toBe('user-admin');
    expect(collisionLog![0].payload.existingDendreoUserId).toBe('999');
    expect(collisionLog![0].payload.newUserId).toBe('user-collision');
    expect(collisionLog![0].payload.newDendreoUserId).toBe('2252');
    expect(collisionLog![0].payload.timestamp).toBeDefined();
  });
});

describe('handleUserWebhook — Cas 3 : aucun match', () => {
  it('creates a new user with both bridges filled when tms_origin=dendreo (bug e)', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'user-new' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 2252,
        tms_origin: 'dendreo',
      },
    });

    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);

    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data.email).toBe('eva@example.com');
    expect(createArg.data.dendreoUserId).toBe('2252');
    expect(createArg.data.externalId).toBe('2252');
    expect(createArg.data.role).toBe('learner');
    expect(createArg.data.isActive).toBe(true);
    expect(createArg.data).not.toHaveProperty('passwordHash');
  });

  it('fills both bridges with default tms_origin=dendreo when not provided', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'user-new' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 2252,
      },
    });

    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data.dendreoUserId).toBe('2252');
    expect(createArg.data.externalId).toBe('2252');
  });

  it('does NOT set dendreoUserId when tms_origin is a different TMS (bug e)', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'user-other' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 'other-id',
        tms_origin: 'other-tms',
      },
    });

    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data.externalId).toBe('other-id');
    expect(createArg.data.dendreoUserId).toBeUndefined();
  });

  it('does NOT set dendreoUserId when external_id is absent', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'user-noid' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        tms_origin: 'dendreo',
      },
    });

    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data.dendreoUserId).toBeUndefined();
    expect(createArg.data.externalId).toBeUndefined();
  });
});

describe('handleUserWebhook — régression admin (jamais role/passwordHash sur match)', () => {
  it('never includes role or passwordHash in update when matching by dendreoUserId, even if payload has password', async () => {
    findUniqueMock.mockImplementation(({ where }) => {
      if (where.dendreoUserId === '2252') {
        return Promise.resolve({
          id: 'user-admin',
          email: 'admin@example.com',
          dendreoUserId: '2252',
          role: 'admin',
          passwordHash: 'admin-hash',
        });
      }
      return Promise.resolve(null);
    });
    updateMock.mockResolvedValue({ id: 'user-admin' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 2252,
        tms_origin: 'dendreo',
        password: 'should-be-ignored',
      },
    });

    const updateArg = updateMock.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('role');
    expect(updateArg.data).not.toHaveProperty('passwordHash');
  });

  it('never includes role or passwordHash in update when rattachement (cas 2a), even if payload has password', async () => {
    findUniqueMock.mockImplementation(({ where }) => {
      if (where.dendreoUserId) return Promise.resolve(null);
      if (where.email === 'admin@example.com') {
        return Promise.resolve({
          id: 'user-admin',
          email: 'admin@example.com',
          dendreoUserId: null,
          role: 'admin',
          passwordHash: 'admin-hash',
        });
      }
      return Promise.resolve(null);
    });
    updateMock.mockResolvedValue({ id: 'user-admin' });

    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'admin@example.com',
        external_id: 2252,
        tms_origin: 'dendreo',
        password: 'should-be-ignored',
      },
    });

    const updateArg = updateMock.mock.calls[0][0];
    expect(updateArg.data.dendreoUserId).toBe('2252');
    expect(updateArg.data).not.toHaveProperty('role');
    expect(updateArg.data).not.toHaveProperty('passwordHash');
  });
});
