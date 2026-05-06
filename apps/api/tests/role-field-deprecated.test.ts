// Phase 2A — décision design : un seul format canonique côté API.
// Les bodies qui envoient `role: 'x'` doivent être rejetés en 400 avec
// un message explicite, sans fallback "role -> [role]".
// On teste les 3 endpoints concernés : dev-login, POST/PUT admin/utilisateurs.

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'development', // dev-login n'est actif qu'en dev
    DENDREO_SIGNATURE_KEY: 'k',
    DENDREO_WEBHOOK_SECRET: '',
    DENDREO_API_KEY: 'k',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '1h',
  },
}));

jest.mock('../src/shared/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../src/shared/eventLog.service', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const upsertMock = jest.fn();
const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const createMock = jest.fn();
jest.mock('../src/config/database', () => ({
  prisma: {
    user: {
      upsert: (...args: unknown[]) => upsertMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { handleDevLogin } from '../src/modules/auth/dev-login.controller';
import { adminUsersRouter } from '../src/modules/admin/users.router';
import { BadRequestError, AppError } from '../src/shared/errors';

const DEPRECATED = "Field 'role' is deprecated. Use 'roles' (array) instead.";

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

async function expectBadRequest(promise: Promise<unknown>, message: string) {
  try {
    await promise;
    throw new Error('Expected BadRequestError, got success');
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).message).toBe(message);
  }
}

// Récupérer les handlers du router admin (POST/PUT) sans monter Express.
function findHandler(method: 'post' | 'put', pattern: string) {
  const layer = (adminUsersRouter as any).stack.find(
    (l: any) => l.route?.path === pattern && l.route.methods[method],
  );
  if (!layer) throw new Error(`Handler ${method.toUpperCase()} ${pattern} introuvable`);
  return layer.route.stack[0].handle;
}

describe("rejet du champ 'role' déprécié (phase 2A)", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    createMock.mockReset();
  });

  it("dev-login : body avec role: 'admin' renvoie 400", async () => {
    const req: any = { body: { email: 'a@b.fr', role: 'admin' } };
    await expectBadRequest(handleDevLogin(req, makeRes()), DEPRECATED);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('dev-login : body avec roles: [admin] est accepté (sanity check)', async () => {
    upsertMock.mockResolvedValue({
      id: 'u1', email: 'a@b.fr', roles: ['admin'], fullName: 'A',
    });
    const req: any = { body: { email: 'a@b.fr', roles: ['admin'] } };
    const res = makeRes();
    await handleDevLogin(req, res);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ roles: ['admin'] }) }),
    );
  });

  it("admin POST /utilisateurs : body avec role: 'admin' renvoie 400", async () => {
    const handler = findHandler('post', '/');
    const req: any = {
      body: { email: 'x@b.fr', fullName: 'X', password: 'longenough1', role: 'admin' },
      user: { userId: 'me', email: 'me@b.fr', roles: ['admin'] },
    };
    const next = jest.fn();
    // asyncHandler renvoie une promesse, l'erreur est passée à next.
    await handler(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.message).toBe(DEPRECATED);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("admin PUT /utilisateurs/:id : body avec role: 'trainer' renvoie 400", async () => {
    const handler = findHandler('put', '/:id');
    const req: any = {
      params: { id: 'u1' },
      body: { role: 'trainer' },
      user: { userId: 'me', email: 'me@b.fr', roles: ['admin'] },
    };
    const next = jest.fn();
    await handler(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.message).toBe(DEPRECATED);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
