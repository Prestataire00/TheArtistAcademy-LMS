import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './formations.controller';

export const adminFormationsRouter = Router();
adminFormationsRouter.use(authenticate, requireRole('admin'));

// GET    /api/v1/admin/formations          — Liste
adminFormationsRouter.get('/', ctrl.list);

// POST   /api/v1/admin/formations          — Créer
adminFormationsRouter.post('/', ctrl.create);

// GET    /api/v1/admin/formations/:id      — Détail
adminFormationsRouter.get('/:id', ctrl.detail);

// PUT    /api/v1/admin/formations/:id      — Modifier
adminFormationsRouter.put('/:id', ctrl.update);

// DELETE /api/v1/admin/formations/:id      — Supprimer
adminFormationsRouter.delete('/:id', ctrl.remove);

// POST   /api/v1/admin/formations/:id/duplicate — Dupliquer
adminFormationsRouter.post('/:id/duplicate', ctrl.duplicate);
