import { Router, Request, Response } from 'express';
import { verifyDendreoWebhookSignature, verifyDendreoApiKey } from './dendreo.middleware';
import {
  handleUserWebhook,
  handleEnrolmentWebhook,
  handleSessionWebhook,
} from './dendreo.webhooks.service';
import { asyncHandler } from '../../shared/errors';
import { prisma } from '../../config/database';

export const dendreoRouter = Router();

// ─── Webhooks entrants Dendreo → LMS ─────────────────────────────────────────
//
// La nouvelle spec Dendreo cible les routes /users, /sessions, /enrolments
// (sans le préfixe /webhooks). On expose les nouveaux paths comme canoniques
// et on garde les anciens en alias pour ne pas casser une intégration en
// cours de bascule.

const userHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await handleUserWebhook(req.body);
  res.json(result);
});

const sessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await handleSessionWebhook(req.body);
  res.json(result);
});

const enrolmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await handleEnrolmentWebhook(req.body);
  res.json(result);
});

// Routes canoniques (nouvelle spec)
dendreoRouter.post('/users', verifyDendreoWebhookSignature, userHandler);
dendreoRouter.post('/sessions', verifyDendreoWebhookSignature, sessionHandler);
dendreoRouter.post('/enrolments', verifyDendreoWebhookSignature, enrolmentHandler);

// Aliases historiques (rétrocompat — ancien code Dendreo qui pointe encore ici)
dendreoRouter.post('/webhooks/users', verifyDendreoWebhookSignature, userHandler);
dendreoRouter.post('/webhooks/enrolments', verifyDendreoWebhookSignature, enrolmentHandler);

// ─── Pull Trainings (Dendreo appelle pour lister les formations) ─────────────

// GET /api/v1/dendreo/trainings — authentifié par X-Auth-API-Key
dendreoRouter.get(
  '/trainings',
  verifyDendreoApiKey,
  asyncHandler(async (_req: Request, res: Response) => {
    const formations = await prisma.formation.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        description: true,
      },
      orderBy: { title: 'asc' },
    });

    res.json(
      formations.map((f) => ({
        training_id: f.id,
        training_title: f.title,
        training_description: f.description,
      })),
    );
  }),
);
