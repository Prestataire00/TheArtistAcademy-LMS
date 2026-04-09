import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const uasRouter = Router();

// GET /api/v1/uas/:id/quiz
uasRouter.get('/:id/quiz', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — charger quiz' });
});

// POST /api/v1/uas/:id/quiz/attempts
uasRouter.post('/:id/quiz/attempts', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — soumettre tentative quiz' });
});

// GET /api/v1/uas/:id/quiz/attempts
uasRouter.get('/:id/quiz/attempts', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — historique tentatives' });
});

// POST /api/v1/uas/:id/video/token — Obtenir URL signée HLS
uasRouter.post('/:id/video/token', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — signed URL vidéo' });
});

// GET /api/v1/uas/:id/resource/download
uasRouter.get('/:id/resource/download', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — URL signée ressource' });
});

// ─── Admin ────────────────────────────────────────────────────────────────────
uasRouter.post('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — créer UA' });
});

uasRouter.put('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — modifier UA' });
});

uasRouter.delete('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — supprimer UA' });
});

uasRouter.post('/:id/video/upload', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — initier upload vidéo' });
});
