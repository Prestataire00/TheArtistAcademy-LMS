import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const resourcesRouter = Router();

// Admin — upload ressource
resourcesRouter.post('/:uaId/upload', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — upload ressource' });
});
