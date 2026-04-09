import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const formationsRouter = Router();

// ─── Apprenant ────────────────────────────────────────────────────────────────
// GET /api/v1/formations/:id — Landing formation
formationsRouter.get('/:id', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — landing formation' });
});

// GET /api/v1/formations/:id/modules
formationsRouter.get('/:id/modules', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — modules de la formation' });
});

// GET /api/v1/formations/:id/resources
formationsRouter.get('/:id/resources', authenticate, (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — ressources de la formation' });
});

// ─── Admin CRUD ───────────────────────────────────────────────────────────────
formationsRouter.get('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — liste catalogue' });
});

formationsRouter.post('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — créer formation' });
});

formationsRouter.put('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — modifier formation' });
});

formationsRouter.delete('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — supprimer formation' });
});
