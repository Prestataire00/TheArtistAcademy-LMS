import { Router } from 'express';

export const healthRouter = Router();

/**
 * Railway healthcheck probe. Mounted before global middlewares (helmet/cors/json)
 * so it stays reachable even if a middleware misbehaves. Pure liveness check:
 * if the process is listening, the probe passes. No DB call — keeps the probe
 * fast and avoids false negatives when the DB is temporarily slow.
 */
healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
