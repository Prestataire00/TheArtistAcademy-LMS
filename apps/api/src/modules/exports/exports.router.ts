import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import * as service from './exports.service';

export const exportsRouter = Router();
exportsRouter.use(authenticate, requireRole('admin'));

function sendCsv(res: Response, csv: string, filename: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// GET /api/v1/admin/exports/learners
exportsRouter.get('/learners', asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.exportLearners(req.query.formationId as string | undefined);
  sendCsv(res, csv, `apprenants_${Date.now()}.csv`);
}));

// GET /api/v1/admin/exports/modules
exportsRouter.get('/modules', asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.exportModules(req.query.formationId as string | undefined);
  sendCsv(res, csv, `modules_${Date.now()}.csv`);
}));

// GET /api/v1/admin/exports/logs
exportsRouter.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.exportLogs(req.query.formationId as string | undefined);
  sendCsv(res, csv, `logs_${Date.now()}.csv`);
}));

// GET /api/v1/admin/exports/reminders
exportsRouter.get('/reminders', asyncHandler(async (_req: Request, res: Response) => {
  const csv = await service.exportReminders();
  sendCsv(res, csv, `relances_${Date.now()}.csv`);
}));
