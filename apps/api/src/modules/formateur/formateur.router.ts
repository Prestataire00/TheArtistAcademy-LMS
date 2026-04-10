import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import * as ctrl from './formateur.controller';

export const formateurRouter = Router();
formateurRouter.use(authenticate, requireRole('trainer'));

// GET /api/v1/formateur/sessions
formateurRouter.get('/sessions', asyncHandler(ctrl.listSessions));

// GET /api/v1/formateur/sessions/:formationId/apprenants
formateurRouter.get('/sessions/:formationId/apprenants', asyncHandler(ctrl.listApprenants));

// GET /api/v1/formateur/sessions/:formationId/apprenants/:userId
formateurRouter.get('/sessions/:formationId/apprenants/:userId', asyncHandler(ctrl.getApprenantDetail));

// GET /api/v1/formateur/sessions/:formationId/stats
formateurRouter.get('/sessions/:formationId/stats', asyncHandler(ctrl.getSessionStats));
