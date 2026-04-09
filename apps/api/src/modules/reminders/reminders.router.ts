import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const remindersRouter = Router();

remindersRouter.get('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — liste règles relances' });
});

remindersRouter.post('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — créer règle relance' });
});

remindersRouter.put('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — modifier règle relance' });
});

remindersRouter.delete('/:id', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — désactiver règle relance' });
});

remindersRouter.get('/logs', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — journal relances' });
});
