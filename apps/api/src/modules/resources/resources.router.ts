import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler, BadRequestError } from '../../shared/errors';
import { verifyTrainerOwnership } from '../../shared/trainer.guard';
import * as ctrl from './resources.controller';

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non accepte. Formats autorises : PDF, PPT, PPTX'));
    }
  },
});

function handleMulterError(err: Error, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError || err.message.includes('Format non accepte')) {
    return next(new BadRequestError(err.message));
  }
  next(err);
}

// ─── Admin/Formateur — Upload/Delete ressource ──────────────────────────────
export const adminResourcesRouter = Router();
adminResourcesRouter.use(authenticate, requireRole('trainer'));

// POST   /api/v1/admin/uas/:id/resource
// Accessible admin (sans restriction) + trainer (uniquement ses formations)
adminResourcesRouter.post('/uas/:id/resource', upload.single('file'), handleMulterError, verifyTrainerOwnership(), asyncHandler(ctrl.adminUpload));

// DELETE /api/v1/admin/uas/:id/resource
adminResourcesRouter.delete('/uas/:id/resource', verifyTrainerOwnership(), asyncHandler(ctrl.adminDelete));

// ─── Player — Liste + Téléchargement ─────────────────────────────────────────
export const playerResourcesRouter = Router();
playerResourcesRouter.use(authenticate, requireRole('learner'));

// GET /api/v1/player/formations/:id/resources
playerResourcesRouter.get('/formations/:id/resources', asyncHandler(ctrl.playerListResources));

// GET /api/v1/player/resources/:id/download
playerResourcesRouter.get('/resources/:id/download', asyncHandler(ctrl.playerDownload));
