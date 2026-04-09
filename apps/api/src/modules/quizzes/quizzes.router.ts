import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const quizzesRouter = Router();

// Admin — gestion quiz
quizzesRouter.put('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — modifier quiz' });
});

quizzesRouter.post('/:id/questions', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — ajouter question' });
});

quizzesRouter.put('/questions/:questionId', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — modifier question' });
});
