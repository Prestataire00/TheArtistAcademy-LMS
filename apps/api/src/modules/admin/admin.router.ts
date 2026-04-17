import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import * as service from './admin.service';
import { generatePreviewUrlByUaId } from '../resources/resources.service';
import { createSignedUrl } from '../videos/videos.service';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));

// GET /api/v1/admin/trainers — Liste des formateurs (pour assignation)
adminRouter.get('/trainers', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.listTrainers();
  res.json({ data });
}));

// GET /api/v1/admin/dashboard/stats
adminRouter.get('/dashboard/stats', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getDashboardStats();
  res.json({ data });
}));

// GET /api/v1/admin/dashboard/sessions (alias apprenants avec filtre)
adminRouter.get('/dashboard/sessions', asyncHandler(async (req: Request, res: Response) => {
  const formationId = req.query.formationId as string | undefined;
  const data = await service.getApprenants(formationId);
  res.json({ data });
}));

// GET /api/v1/admin/sso/logs
adminRouter.get('/sso/logs', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getSsoLogs();
  res.json({ data });
}));

// GET /api/v1/admin/relances
adminRouter.get('/relances', asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getReminderLogs();
  res.json({ data });
}));

// GET /api/v1/admin/resources/:uaId/preview — Signed URL pour preview/download admin
adminRouter.get('/resources/:uaId/preview', asyncHandler(async (req: Request, res: Response) => {
  const data = await generatePreviewUrlByUaId(req.params.uaId);
  res.json({ data });
}));

// GET /api/v1/admin/videos/:uaId/preview — Signed URL video pour preview admin
adminRouter.get('/videos/:uaId/preview', asyncHandler(async (req: Request, res: Response) => {
  const signedUrl = await createSignedUrl(req.params.uaId);
  res.json({ data: { signedUrl } });
}));
