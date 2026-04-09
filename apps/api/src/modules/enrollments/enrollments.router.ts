import { Router } from 'express';
import { authenticate } from '../../middleware/auth';

export const enrollmentsRouter = Router();

// GET /api/v1/enrollments/:id/progress — Progression complète
enrollmentsRouter.get('/:id/progress', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — progression complète enrollment' });
});
