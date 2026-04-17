import { Router } from 'express';
import { handleSso, getSsoStatus } from './auth.controller';
import { handleLogin } from './login.controller';
import { handleDevLogin } from './dev-login.controller';
import { ssoRateLimiter, loginRateLimiter } from '../../middleware/rateLimiter';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../shared/errors';
import { env } from '../../config/env';

export const authRouter = Router();

// POST /api/v1/auth/sso — Validation JWT Dendreo, création session LMS
authRouter.post('/sso', ssoRateLimiter, asyncHandler(handleSso));

// POST /api/v1/auth/login — Connexion email + mot de passe (trainer / admin)
authRouter.post('/login', loginRateLimiter, asyncHandler(handleLogin));

// POST /api/v1/auth/dev-login — Login dev (development only)
if (env.NODE_ENV === 'development') {
  authRouter.post('/dev-login', asyncHandler(handleDevLogin));
}

// GET /api/v1/auth/sso/status — Diagnostic SSO (admin)
authRouter.get('/sso/status', authenticate, requireRole('admin'), getSsoStatus);

// GET /api/v1/auth/me — Infos utilisateur courant
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
