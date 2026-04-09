import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const exportsRouter = Router();

// POST /api/v1/admin/exports/learners
exportsRouter.post('/learners', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — export CSV apprenants' });
});

// POST /api/v1/admin/exports/modules
exportsRouter.post('/modules', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — export CSV modules' });
});

// POST /api/v1/admin/exports/logs
exportsRouter.post('/logs', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — export CSV logs' });
});

// POST /api/v1/admin/exports/reminders
exportsRouter.post('/reminders', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — export CSV relances' });
});
