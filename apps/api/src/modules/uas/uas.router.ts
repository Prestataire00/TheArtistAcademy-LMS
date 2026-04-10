import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './uas.controller';

export const adminUAsRouter = Router();
adminUAsRouter.use(authenticate, requireRole('admin'));

// GET    /api/v1/admin/modules/:moduleId/uas   — Liste UAs d'un module
adminUAsRouter.get('/modules/:moduleId/uas', ctrl.list);

// POST   /api/v1/admin/uas                     — Créer
adminUAsRouter.post('/uas', ctrl.create);

// GET    /api/v1/admin/uas/:id                 — Détail
adminUAsRouter.get('/uas/:id', ctrl.detail);

// PUT    /api/v1/admin/uas/:id                 — Modifier
adminUAsRouter.put('/uas/:id', ctrl.update);

// DELETE /api/v1/admin/uas/:id                 — Supprimer
adminUAsRouter.delete('/uas/:id', ctrl.remove);
