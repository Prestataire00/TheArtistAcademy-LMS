import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { progressRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import * as ctrl from './videos.controller';

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Seuls les fichiers vidéo sont acceptés (reçu : ${file.mimetype || 'type inconnu'})`));
    }
  },
});

// Convertit les erreurs multer (limite de taille, mime rejeté par fileFilter,
// champ inattendu, etc.) en BadRequestError pour que le client voie le vrai
// message au lieu d'un 500 générique. Sans ça, errorHandler swallow l'erreur.
function handleMulterError(err: Error, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Fichier trop volumineux (max ${MAX_VIDEO_BYTES / (1024 * 1024)} Mo)`
      : err.message;
    return next(new BadRequestError(message));
  }
  if (err.message.includes('Seuls les fichiers vidéo')) {
    return next(new BadRequestError(err.message));
  }
  next(err);
}

// Marque T0 sur la requête AVANT multer pour mesurer le temps de parsing
// multipart (multer_ms = T1 - T0 dans le controller).
function markUploadStart(req: Request & { uploadStartedAt?: number }, _res: Response, next: NextFunction) {
  req.uploadStartedAt = Date.now();
  next();
}

// ─── Admin — Upload vidéo ─────────────────────────────────────────────────────
export const adminVideosRouter = Router();
// Routes de gestion de contenu : ouvertes à trainer + admin + superadmin.
adminVideosRouter.use(authenticate, requireRole('trainer', 'admin', 'superadmin'));

// POST /api/v1/admin/uas/:id/video
adminVideosRouter.post('/uas/:id/video', markUploadStart, upload.single('file'), handleMulterError, asyncHandler(ctrl.adminUpload));

// ─── Player — Lecture apprenant ───────────────────────────────────────────────
export const playerRouter = Router();
playerRouter.use(authenticate, requireRole('learner'));

// GET  /api/v1/player/uas/:id/stream
playerRouter.get('/uas/:id/stream', asyncHandler(ctrl.playerStream));

// POST /api/v1/player/uas/:id/progress
playerRouter.post('/uas/:id/progress', progressRateLimiter, asyncHandler(ctrl.playerSaveProgress));

// GET  /api/v1/player/uas/:id/progress
playerRouter.get('/uas/:id/progress', asyncHandler(ctrl.playerGetProgress));
