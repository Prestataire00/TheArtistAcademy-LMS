import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { logEvent } from '../../shared/eventLog.service';
import * as service from './reminders.service';

export const remindersRouter = Router();
remindersRouter.use(authenticate, requireRole('admin'));

// GET /api/v1/admin/relances — journal filtrable
remindersRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, formationId } = req.query as Record<string, string | undefined>;
  const data = await service.listReminderLogs({ status, formationId });
  res.json({ data });
}));

// GET /api/v1/admin/relances/test/:enrollmentId — envoi manuel de test
remindersRouter.get('/test/:enrollmentId', asyncHandler(async (req: Request, res: Response) => {
  const { enrollmentId } = req.params;
  const result = await service.sendTestReminder(enrollmentId);
  await logEvent({
    category: 'admin',
    action: 'reminder_test',
    userId: req.user!.userId,
    enrollmentId,
    payload: { status: result.status },
    ipAddress: req.ip,
  });
  res.json({ data: result });
}));
