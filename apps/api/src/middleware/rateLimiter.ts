import rateLimit from 'express-rate-limit';

export const ssoRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de requêtes, réessayez plus tard.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const progressRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // heartbeat toutes les 15s max = 4/min, marge large
  standardHeaders: true,
  legacyHeaders: false,
});
