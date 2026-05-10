import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { verifyTrainerOwnership } from '../../shared/trainer.guard';
import * as ctrl from './quizzes.controller';

// ─── Admin/Formateur — Gestion quiz ──────────────────────────────────────────
export const adminQuizzesRouter = Router();
// Routes de gestion de contenu : ouvertes à trainer + admin + superadmin.
// L'ownership formation est ré-vérifiée par verifyTrainerOwnership() en aval
// pour les trainers (admins/superadmins passent sans restriction).
adminQuizzesRouter.use(authenticate, requireRole('trainer', 'admin', 'superadmin'));

// GET /api/v1/admin/uas/:id/quiz — Charger le quiz d'une UA (avec isCorrect)
adminQuizzesRouter.get('/uas/:id/quiz', verifyTrainerOwnership(), asyncHandler(ctrl.adminGetQuiz));

// PUT /api/v1/admin/uas/:id/quiz — Créer ou remplacer le quiz d'une UA
adminQuizzesRouter.put('/uas/:id/quiz', verifyTrainerOwnership(), asyncHandler(ctrl.adminUpsertQuiz));

// ─── Player — Quiz apprenant ──────────────────────────────────────────────────
export const playerQuizRouter = Router();
playerQuizRouter.use(authenticate, requireRole('learner'));

// GET  /api/v1/player/uas/:id/quiz           — Charger quiz (sans isCorrect)
playerQuizRouter.get('/uas/:id/quiz', asyncHandler(ctrl.playerGetQuiz));

// POST /api/v1/player/uas/:id/quiz/submit    — Soumettre tentative
playerQuizRouter.post('/uas/:id/quiz/submit', asyncHandler(ctrl.playerSubmit));

// GET  /api/v1/player/uas/:id/quiz/attempts  — Historique tentatives
playerQuizRouter.get('/uas/:id/quiz/attempts', asyncHandler(ctrl.playerGetAttempts));
