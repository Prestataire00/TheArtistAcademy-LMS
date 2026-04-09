import { Router } from 'express';
import { handleSso, getSsoStatus } from './auth.controller';
import { ssoRateLimiter } from '../../middleware/rateLimiter';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';

export const authRouter = Router();

// POST /api/v1/auth/sso — Validation JWT Dendreo, création session LMS
authRouter.post('/sso', ssoRateLimiter, handleSso);

// GET /api/v1/auth/sso/status — Diagnostic SSO (admin)
authRouter.get('/sso/status', authenticate, requireRole('admin'), getSsoStatus);

// GET /api/v1/auth/me — Infos utilisateur courant
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
