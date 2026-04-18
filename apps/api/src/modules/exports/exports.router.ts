import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { logEvent } from '../../shared/eventLog.service';
import * as service from './exports.service';

export const exportsRouter = Router();
exportsRouter.use(authenticate, requireRole('admin'));

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sendCsv(res: Response, csv: string, baseName: string) {
  const filename = `${baseName}_${timestamp()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

async function logExport(req: Request, action: string, payload: Record<string, unknown>) {
  await logEvent({
    category: 'admin',
    action,
    userId: req.user!.userId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    payload,
  });
}

// GET /api/v1/admin/exports/apprenants
exportsRouter.get('/apprenants', asyncHandler(async (req: Request, res: Response) => {
  const { formationId, from, to } = req.query as Record<string, string | undefined>;
  const csv = await service.exportLearners(formationId, from, to);
  await logExport(req, 'export_apprenants', { formationId, from, to });
  sendCsv(res, csv, 'apprenants');
}));

// GET /api/v1/admin/exports/modules
exportsRouter.get('/modules', asyncHandler(async (req: Request, res: Response) => {
  const { formationId } = req.query as Record<string, string | undefined>;
  const csv = await service.exportModules(formationId);
  await logExport(req, 'export_modules', { formationId });
  sendCsv(res, csv, 'modules');
}));

// GET /api/v1/admin/exports/logs
exportsRouter.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  const csv = await service.exportLogs(from, to);
  await logExport(req, 'export_logs', { from, to });
  sendCsv(res, csv, 'logs');
}));

// GET /api/v1/admin/exports/relances
exportsRouter.get('/relances', asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.exportReminders();
  await logExport(req, 'export_relances', {});
  sendCsv(res, csv, 'relances');
}));
