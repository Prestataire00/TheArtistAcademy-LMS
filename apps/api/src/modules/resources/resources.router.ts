import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import * as ctrl from './resources.controller';

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non accepté. Formats autorisés : PDF, PPT, PPTX'));
    }
  },
});

/** Convertit les erreurs multer en BadRequestError pour le error handler Express. */
function handleMulterError(err: Error, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError || err.message.includes('Format non accepté')) {
    return next(new BadRequestError(err.message));
  }
  next(err);
}

// ─── Admin — Upload/Delete ressource ──────────────────────────────────────────
export const adminResourcesRouter = Router();
adminResourcesRouter.use(authenticate, requireRole('admin'));

// POST   /api/v1/admin/uas/:id/resource
adminResourcesRouter.post('/uas/:id/resource', upload.single('file'), handleMulterError, asyncHandler(ctrl.adminUpload));

// DELETE /api/v1/admin/uas/:id/resource
adminResourcesRouter.delete('/uas/:id/resource', asyncHandler(ctrl.adminDelete));

// ─── Player — Liste + Téléchargement ─────────────────────────────────────────
export const playerResourcesRouter = Router();
playerResourcesRouter.use(authenticate, requireRole('learner'));

// GET /api/v1/player/formations/:id/resources
playerResourcesRouter.get('/formations/:id/resources', asyncHandler(ctrl.playerListResources));

// GET /api/v1/player/resources/:id/download
playerResourcesRouter.get('/resources/:id/download', asyncHandler(ctrl.playerDownload));
