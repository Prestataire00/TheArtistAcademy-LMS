// Tests du middleware de signature webhooks Dendreo + API key.
// Régression du bug "HMAC 500 → 401" : crypto.timingSafeEqual lève une
// RangeError quand les buffers ont des longueurs différentes ; sans guard,
// l'erreur remontait au global error handler en 500 INTERNAL_ERROR au lieu
// du 401 attendu, fuitant l'existence du endpoint et fragilisant la posture
// de sécurité.

import crypto from 'crypto';

const SIGNATURE_KEY = 'test-signature-key';
const API_KEY = 'test-api-key-32chars-padding-here';

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    DENDREO_SIGNATURE_KEY: 'test-signature-key',
    DENDREO_WEBHOOK_SECRET: '',
    DENDREO_API_KEY: 'test-api-key-32chars-padding-here',
  },
}));

jest.mock('../src/shared/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  verifyDendreoWebhookSignature,
  verifyDendreoApiKey,
} from '../src/modules/dendreo/dendreo.middleware';
import { UnauthorizedError, AppError } from '../src/shared/errors';

function makeWebhookReq(opts: { signature?: string; rawBody: Buffer; body?: any }): any {
  return {
    headers: opts.signature !== undefined ? { signature: opts.signature } : {},
    body: opts.body ?? {},
    rawBody: opts.rawBody,
  };
}

function makeApiKeyReq(opts: { apiKey?: string }): any {
  return {
    headers: opts.apiKey !== undefined ? { 'x-auth-api-key': opts.apiKey } : {},
    path: '/api/v1/dendreo/trainings',
  };
}

function expect401(fn: () => void) {
  try {
    fn();
    throw new Error('Expected to throw, but did not');
  } catch (err) {
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect((err as AppError).statusCode).toBe(401);
  }
}

describe('verifyDendreoWebhookSignature', () => {
  const body = { event: 'user.created', tenant_id: 'taa-test', data: {} };
  const rawBody = Buffer.from(JSON.stringify(body));
  const validSignature = crypto
    .createHmac('sha256', SIGNATURE_KEY)
    .update(rawBody)
    .digest('hex');

  it('passes through when signature is valid', () => {
    const req = makeWebhookReq({ signature: validSignature, rawBody, body });
    const next = jest.fn();
    verifyDendreoWebhookSignature(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 (NOT 500) when signature has correct length but wrong value', () => {
    const wrong = crypto.createHmac('sha256', 'WRONG-SECRET').update(rawBody).digest('hex');
    const req = makeWebhookReq({ signature: wrong, rawBody, body });
    expect401(() => verifyDendreoWebhookSignature(req, {} as any, jest.fn()));
  });

  it('returns 401 (NOT 500) when signature has different length', () => {
    // 'aabbcc' = 3 bytes, valid SHA-256 = 32 bytes — sans guard, RangeError → 500
    const req = makeWebhookReq({ signature: 'aabbcc', rawBody, body });
    expect401(() => verifyDendreoWebhookSignature(req, {} as any, jest.fn()));
  });

  it('returns 401 (NOT 500) when signature is non-hex garbage', () => {
    // Buffer.from('not-a-hex-string', 'hex') → Buffer length 0 (parsing s'arrête au 1er char non-hex)
    const req = makeWebhookReq({ signature: 'not-a-hex-string', rawBody, body });
    expect401(() => verifyDendreoWebhookSignature(req, {} as any, jest.fn()));
  });
});

describe('verifyDendreoApiKey', () => {
  it('passes through when API key matches', () => {
    const req = makeApiKeyReq({ apiKey: API_KEY });
    const next = jest.fn();
    verifyDendreoApiKey(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 (NOT 500) when API key has same length but wrong value', () => {
    const wrong = 'X'.repeat(API_KEY.length);
    const req = makeApiKeyReq({ apiKey: wrong });
    expect401(() => verifyDendreoApiKey(req, {} as any, jest.fn()));
  });

  it('returns 401 (NOT 500) when API key has different length', () => {
    const req = makeApiKeyReq({ apiKey: 'short' });
    expect401(() => verifyDendreoApiKey(req, {} as any, jest.fn()));
  });

  it('returns 401 when API key header is absent', () => {
    const req = makeApiKeyReq({});
    expect401(() => verifyDendreoApiKey(req, {} as any, jest.fn()));
  });
});
