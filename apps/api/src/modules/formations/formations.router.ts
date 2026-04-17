import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import * as ctrl from './formations.controller';

export const adminFormationsRouter = Router();
adminFormationsRouter.use(authenticate, requireRole('admin'));

// GET    /api/v1/admin/formations          — Liste
adminFormationsRouter.get('/', asyncHandler(ctrl.list));

// POST   /api/v1/admin/formations          — Créer
adminFormationsRouter.post('/', asyncHandler(ctrl.create));

// GET    /api/v1/admin/formations/:id      — Détail
adminFormationsRouter.get('/:id', asyncHandler(ctrl.detail));

// PUT    /api/v1/admin/formations/:id      — Modifier
adminFormationsRouter.put('/:id', asyncHandler(ctrl.update));

// DELETE /api/v1/admin/formations/:id      — Supprimer
adminFormationsRouter.delete('/:id', asyncHandler(ctrl.remove));

// POST   /api/v1/admin/formations/:id/duplicate — Dupliquer
adminFormationsRouter.post('/:id/duplicate', asyncHandler(ctrl.duplicate));
