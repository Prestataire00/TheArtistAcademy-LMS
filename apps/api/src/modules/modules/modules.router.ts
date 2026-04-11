import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as ctrl from './modules.controller';

export const adminModulesRouter = Router();
// trainer dans la hierarchie permet admin+superadmin aussi
// Les routes de creation/suppression sont protegees par le guard ownership pour les trainers
adminModulesRouter.use(authenticate, requireRole('trainer'));

// GET    /api/v1/admin/formations/:formationId/modules        — Liste modules d'une formation
adminModulesRouter.get('/formations/:formationId/modules', ctrl.list);

// PUT    /api/v1/admin/formations/:formationId/modules/reorder — Réordonner
adminModulesRouter.put('/formations/:formationId/modules/reorder', ctrl.reorder);

// POST   /api/v1/admin/modules                                — Créer
adminModulesRouter.post('/modules', ctrl.create);

// GET    /api/v1/admin/modules/:id                            — Détail
adminModulesRouter.get('/modules/:id', ctrl.detail);

// PUT    /api/v1/admin/modules/:id                            — Modifier
adminModulesRouter.put('/modules/:id', ctrl.update);

// DELETE /api/v1/admin/modules/:id                            — Supprimer
adminModulesRouter.delete('/modules/:id', ctrl.remove);

// POST   /api/v1/admin/modules/:id/duplicate                  — Dupliquer avec UAs + ressources
adminModulesRouter.post('/modules/:id/duplicate', ctrl.duplicate);
