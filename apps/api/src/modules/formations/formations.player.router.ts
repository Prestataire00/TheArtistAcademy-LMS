import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { playerGetFormation } from './formations.player.controller';

export const playerFormationsRouter = Router();
// Pré-revert phase 2A, requireRole avait une hiérarchie linéaire qui laissait
// admin/superadmin/trainer accéder aux routes /player. Le revert mono-rôle a
// retiré cette hiérarchie ; on liste donc explicitement les rôles autorisés
// ici. Le service applique la logique fine : learner = enrollment requis,
// staff (admin/superadmin/trainer) = bypass enrollment (preview/admin view).
// Le filtre par assignation pour les trainers viendra au chantier 2/3.
playerFormationsRouter.use(authenticate, requireRole('learner', 'admin', 'superadmin', 'trainer'));

// GET /api/v1/player/formations/:id — Page formation apprenant
playerFormationsRouter.get('/formations/:id', asyncHandler(playerGetFormation));
