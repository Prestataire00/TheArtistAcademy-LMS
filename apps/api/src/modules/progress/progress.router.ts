import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { progressRateLimiter } from '../../middleware/rateLimiter';

export const progressRouter = Router();

// POST /api/v1/progress/video — Heartbeat progression vidéo (toutes les 15s)
progressRouter.post('/video', authenticate, progressRateLimiter, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — heartbeat vidéo' });
});

// POST /api/v1/progress/resource — Logger ouverture ressource
progressRouter.post('/resource', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — log ouverture ressource' });
});
