import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const adminRouter = Router();

// GET /api/v1/admin/formations/:id/dashboard
adminRouter.get('/formations/:id/dashboard', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 2 — dashboard formation admin' });
});

// GET /api/v1/admin/enrollments
adminRouter.get('/enrollments', authenticate, requireRole('admin'), (_req, res) => {
  res.json({ message: 'TODO: Phase 2 — liste enrollments avec filtres' });
});

// GET /api/v1/admin/trainer/sessions/:sessionId/learners
adminRouter.get('/trainer/sessions/:sessionId/learners', authenticate, requireRole('trainer'), (_req, res) => {
  res.json({ message: 'TODO: Phase 2 — apprenants par session (formateur)' });
});

// GET /api/v1/admin/trainer/enrollments/:id/detail
adminRouter.get('/trainer/enrollments/:id/detail', authenticate, requireRole('trainer'), (_req, res) => {
  res.json({ message: 'TODO: Phase 2 — détail apprenant formateur' });
});
