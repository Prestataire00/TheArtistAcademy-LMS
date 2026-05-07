import { Router } from 'express';
import { handleSso, getSsoStatus } from './auth.controller';
import { handleLogin } from './login.controller';
import { handleLogout } from './logout.controller';
import { handleForgotPassword, handleResetPassword } from './password-reset.controller';
import { handleDevLogin } from './dev-login.controller';
import { ssoRateLimiter, loginRateLimiter } from '../../middleware/rateLimiter';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { userIsAssignedTrainer } from '../../shared/formation-assignment.guard';
import { env } from '../../config/env';

export const authRouter = Router();

// GET /api/v1/auth/sso?jwt=xxx&return_to=...&dendreo_return_to=...
authRouter.get('/sso', ssoRateLimiter, asyncHandler(handleSso));

// Alias canonique nouvelle spec — pointe sur le même handler
authRouter.get('/dendreo-sso', ssoRateLimiter, asyncHandler(handleSso));

// POST /api/v1/auth/login — Connexion email + mot de passe (trainer / admin)
authRouter.post('/login', loginRateLimiter, asyncHandler(handleLogin));

// POST /api/v1/auth/logout — Déconnexion (clear cookie httpOnly)
authRouter.post('/logout', handleLogout);

// POST /api/v1/auth/forgot-password — Demande de reinitialisation mot de passe
authRouter.post('/forgot-password', loginRateLimiter, asyncHandler(handleForgotPassword));

// POST /api/v1/auth/reset-password — Reinitialisation mot de passe avec token
authRouter.post('/reset-password', asyncHandler(handleResetPassword));

// POST /api/v1/auth/dev-login — Login dev (development only)
if (env.NODE_ENV === 'development') {
  authRouter.post('/dev-login', asyncHandler(handleDevLogin));
}

// GET /api/v1/auth/sso/status — Diagnostic SSO (admin)
authRouter.get('/sso/status', authenticate, requireRole('admin', 'superadmin'), getSsoStatus);

// GET /api/v1/auth/me — Infos utilisateur courant
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/v1/auth/me/is-assigned-trainer — Le user authentifié est-il
// assigné comme formateur sur au moins une formation (Formation.trainerId) ?
// Utilisé par le frontend pour décider d'afficher le bouton de bascule
// admin↔formateur dans la sidebar.
authRouter.get('/me/is-assigned-trainer', authenticate, asyncHandler(async (req, res) => {
  const isAssignedTrainer = await userIsAssignedTrainer(req.user!.userId);
  res.json({ isAssignedTrainer });
}));
