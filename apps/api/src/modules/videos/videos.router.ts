import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { progressRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../shared/errors';
import * as ctrl from './videos.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers vidéo sont acceptés'));
    }
  },
});

// ─── Admin — Upload vidéo ─────────────────────────────────────────────────────
export const adminVideosRouter = Router();
adminVideosRouter.use(authenticate, requireRole('admin'));

// POST /api/v1/admin/uas/:id/video
adminVideosRouter.post('/uas/:id/video', upload.single('file'), asyncHandler(ctrl.adminUpload));

// ─── Player — Lecture apprenant ───────────────────────────────────────────────
export const playerRouter = Router();
playerRouter.use(authenticate, requireRole('learner'));

// GET  /api/v1/player/uas/:id/stream
playerRouter.get('/uas/:id/stream', asyncHandler(ctrl.playerStream));

// POST /api/v1/player/uas/:id/progress
playerRouter.post('/uas/:id/progress', progressRateLimiter, asyncHandler(ctrl.playerSaveProgress));

// GET  /api/v1/player/uas/:id/progress
playerRouter.get('/uas/:id/progress', asyncHandler(ctrl.playerGetProgress));
