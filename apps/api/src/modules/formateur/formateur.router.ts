import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import * as ctrl from './formateur.controller';
import * as contenusCtrl from './formateur.contenus.controller';

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format non accepte. Formats autorises : PDF, PPT, PPTX'));
  },
});

function handleMulterError(err: Error, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError || err.message.includes('Format non accepte')) {
    return next(new BadRequestError(err.message));
  }
  next(err);
}

export const formateurRouter = Router();
formateurRouter.use(authenticate, requireRole('trainer'));

// ─── Suivi pedagogique ────────────────────────────────────────────────────────
formateurRouter.get('/sessions', asyncHandler(ctrl.listSessions));
formateurRouter.get('/sessions/:formationId/apprenants', asyncHandler(ctrl.listApprenants));
formateurRouter.get('/sessions/:formationId/apprenants/:userId', asyncHandler(ctrl.getApprenantDetail));
formateurRouter.get('/sessions/:formationId/stats', asyncHandler(ctrl.getSessionStats));

// ─── Gestion contenus (6.3 PRD) ──────────────────────────────────────────────
// GET    /formateur/contenus                    — Liste formations + UAs editables
formateurRouter.get('/contenus', asyncHandler(contenusCtrl.listContent));

// GET    /formateur/contenus/uas/:uaId/quiz     — Lire quiz (avec isCorrect)
formateurRouter.get('/contenus/uas/:uaId/quiz', asyncHandler(contenusCtrl.getQuiz));

// PUT    /formateur/contenus/uas/:uaId/quiz     — Creer/modifier quiz
formateurRouter.put('/contenus/uas/:uaId/quiz', asyncHandler(contenusCtrl.upsertQuiz));

// POST   /formateur/contenus/uas/:uaId/resource — Upload ressource
formateurRouter.post('/contenus/uas/:uaId/resource', upload.single('file'), handleMulterError, asyncHandler(contenusCtrl.uploadResource));

// DELETE /formateur/contenus/uas/:uaId/resource — Supprimer ressource
formateurRouter.delete('/contenus/uas/:uaId/resource', asyncHandler(contenusCtrl.deleteResource));

// GET    /formateur/contenus/uas/:uaId/resource/preview — Previsualiser ressource
formateurRouter.get('/contenus/uas/:uaId/resource/preview', asyncHandler(contenusCtrl.previewResource));
