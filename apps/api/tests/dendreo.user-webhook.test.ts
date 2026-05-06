// Test du handler user.created — bug e (option A) : on remplit aussi
// `dendreoUserId` en plus de `externalId`. Les deux colonnes représentent
// le même `id_participant` côté Dendreo ; les garder synchronisées permet
// au fallback SSO (auth.service.findUserForSso) et au futur matching du
// webhook (bug c) de s'appuyer sur `dendreoUserId` indexé unique.

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

jest.mock('../src/shared/eventLog.service', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/modules/dendreo/dendreo.progression.service', () => ({
  sendProgressionToDendreo: jest.fn(),
}));

jest.mock('../src/modules/dendreo/dendreo.api.client', () => ({
  fetchDendreoParticipant: jest.fn(),
}));

const upsertMock = jest.fn();
jest.mock('../src/config/database', () => ({
  prisma: {
    user: { upsert: (...args: unknown[]) => upsertMock(...args) },
  },
}));

import { handleUserWebhook } from '../src/modules/dendreo/dendreo.webhooks.service';

describe('handleUserWebhook — bug e fix (option A: fill both bridges)', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ id: 'cuid-stub', email: 'eva@example.com' });
  });

  it('fills both dendreoUserId AND externalId on create when tms_origin=dendreo', async () => {
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

    const callArg = upsertMock.mock.calls[0][0];
    expect(callArg.create.externalId).toBe('2252');
    expect(callArg.create.dendreoUserId).toBe('2252');
    expect(callArg.update.externalId).toBe('2252');
    expect(callArg.update.dendreoUserId).toBe('2252');
  });

  it('fills both bridges with default tms_origin=dendreo when not provided', async () => {
    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        external_id: 2252,
      },
    });

    const callArg = upsertMock.mock.calls[0][0];
    expect(callArg.create.dendreoUserId).toBe('2252');
  });

  it('does NOT set dendreoUserId when tms_origin is a different TMS', async () => {
    // Si demain on accueille un autre TMS, dendreoUserId doit rester NULL
    // pour ne pas conflater l'identité Dendreo avec celle d'un autre système.
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

    const callArg = upsertMock.mock.calls[0][0];
    expect(callArg.create.externalId).toBe('other-id');
    expect(callArg.create.dendreoUserId).toBeUndefined();
    expect(callArg.update.dendreoUserId).toBeUndefined();
  });

  it('does NOT set dendreoUserId when external_id is absent', async () => {
    // externalId null/undefined → on n'écrase pas un éventuel dendreoUserId
    // existant avec null. Spread conditionnel.
    await handleUserWebhook({
      event: 'user.created',
      data: {
        firstname: 'EVA',
        lastname: 'TEST',
        email: 'eva@example.com',
        tms_origin: 'dendreo',
      },
    });

    const callArg = upsertMock.mock.calls[0][0];
    expect(callArg.create.dendreoUserId).toBeUndefined();
    expect(callArg.update.dendreoUserId).toBeUndefined();
  });
});
