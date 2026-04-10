import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { playerGetFormation } from './formations.player.controller';

export const playerFormationsRouter = Router();
playerFormationsRouter.use(authenticate, requireRole('learner'));

// GET /api/v1/player/formations/:id — Page formation apprenant
playerFormationsRouter.get('/formations/:id', asyncHandler(playerGetFormation));
