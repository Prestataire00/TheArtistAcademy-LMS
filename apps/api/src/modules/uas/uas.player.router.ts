import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { playerGetUA } from './uas.player.controller';

export const playerUAsRouter = Router();
playerUAsRouter.use(authenticate, requireRole('learner'));

// GET /api/v1/player/uas/:id — Métadonnées UA pour l'apprenant
playerUAsRouter.get('/uas/:id', asyncHandler(playerGetUA));
