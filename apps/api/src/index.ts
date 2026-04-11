import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './shared/errors';

// Routers
import { authRouter } from './modules/auth/auth.router';
import { adminFormationsRouter } from './modules/formations/formations.router';
import { adminModulesRouter } from './modules/modules/modules.router';
import { adminUAsRouter } from './modules/uas/uas.router';
import { adminVideosRouter, playerRouter } from './modules/videos/videos.router';
import { adminQuizzesRouter, playerQuizRouter } from './modules/quizzes/quizzes.router';
import { adminResourcesRouter, playerResourcesRouter } from './modules/resources/resources.router';
import { playerFormationsRouter } from './modules/formations/formations.player.router';
import { playerUAsRouter } from './modules/uas/uas.player.router';
import { progressRouter } from './modules/progress/progress.router';
import { enrollmentsRouter } from './modules/enrollments/enrollments.router';
import { exportsRouter } from './modules/exports/exports.router';
import { remindersRouter } from './modules/reminders/reminders.router';
import { formateurRouter } from './modules/formateur/formateur.router';
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
// Force UTF-8 sur toutes les reponses JSON
app.use((_req, res, next) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); next(); });
app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────
const api = express.Router();

api.use('/auth', authRouter);
api.use('/progress', progressRouter);
api.use('/enrollments', enrollmentsRouter);

// Admin — catalogue (quiz/resources avant UAs car routes plus specifiques)
api.use('/admin/formations', adminFormationsRouter);
api.use('/admin', adminModulesRouter);
api.use('/admin', adminQuizzesRouter);
api.use('/admin', adminResourcesRouter);
api.use('/admin', adminVideosRouter);
api.use('/admin', adminUAsRouter);

// Player — apprenant
api.use('/player', playerFormationsRouter);
api.use('/player', playerRouter);
api.use('/player', playerQuizRouter);
api.use('/player', playerResourcesRouter);
api.use('/player', playerUAsRouter);

// Formateur
api.use('/formateur', formateurRouter);

// Admin — autres
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
