import { Router } from 'express';

export const webhooksRouter = Router();

// POST /api/v1/webhooks/bunny/transcoding — Statut transcodage Bunny.net
webhooksRouter.post('/bunny/transcoding', (_req, res) => {
  res.json({ message: 'TODO: Phase 1 — webhook transcodage Bunny' });
});

// POST /api/v1/webhooks/dendreo/enrollment — Enrollments entrants Dendreo
webhooksRouter.post('/dendreo/enrollment', (_req, res) => {
  res.json({ message: 'TODO: Phase 3 — webhook enrollment Dendreo' });
});
