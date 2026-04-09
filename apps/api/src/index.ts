import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './shared/errors';

// Routers
import { authRouter } from './modules/auth/auth.router';
import { formationsRouter } from './modules/formations/formations.router';
import { uasRouter } from './modules/uas/uas.router';
import { progressRouter } from './modules/progress/progress.router';
import { quizzesRouter } from './modules/quizzes/quizzes.router';
import { resourcesRouter } from './modules/resources/resources.router';
import { enrollmentsRouter } from './modules/enrollments/enrollments.router';
import { exportsRouter } from './modules/exports/exports.router';
import { remindersRouter } from './modules/reminders/reminders.router';
import { adminRouter } from './modules/admin/admin.router';
import { webhooksRouter } from './modules/webhooks/webhooks.router';

// Jobs
import { startReminderScheduler } from './jobs/sendReminders.job';

const app = express();

// ─── Middlewares globaux ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────
const api = express.Router();

api.use('/auth', authRouter);
api.use('/formations', formationsRouter);
api.use('/uas', uasRouter);
api.use('/progress', progressRouter);
api.use('/enrollments', enrollmentsRouter);
api.use('/admin/formations', formationsRouter);
api.use('/admin/exports', exportsRouter);
api.use('/admin/reminder-rules', remindersRouter);
api.use('/admin', adminRouter);
api.use('/webhooks', webhooksRouter);

app.use('/api/v1', api);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Error handler global ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`API running on port ${env.PORT} [${env.NODE_ENV}]`);
  startReminderScheduler();
});

export default app;
