import { Router } from 'express';
import { prisma } from './config/database';

export const healthRouter = Router();

/**
 * Railway healthcheck probe. Mounted before global middlewares so it stays
 * reachable even if helmet/cors/json misbehave. Returns 503 when Prisma can't
 * reach the DB so Railway surfaces the failure instead of marking the deploy
 * healthy on a dead database.
 */
healthRouter.get('/health', async (_req, res) => {
  const timestamp = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', timestamp, db: 'ok' });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      timestamp,
      db: 'error',
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
});
