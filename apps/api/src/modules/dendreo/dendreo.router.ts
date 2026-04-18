import { Router, Request, Response } from 'express';
import { verifyDendreoWebhookSignature, verifyDendreoApiKey } from './dendreo.middleware';
import { handleUserWebhook, handleEnrolmentWebhook } from './dendreo.webhooks.service';
import { asyncHandler } from '../../shared/errors';
import { prisma } from '../../config/database';

export const dendreoRouter = Router();

// ─── Webhooks entrants Dendreo → LMS ─────────────────────────────────────────

// POST /api/v1/dendreo/webhooks/users — user.created
dendreoRouter.post(
  '/webhooks/users',
  verifyDendreoWebhookSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await handleUserWebhook(req.body);
    res.json(result);
  }),
);

// POST /api/v1/dendreo/webhooks/enrolments — enrolment.created / updated / deleted
dendreoRouter.post(
  '/webhooks/enrolments',
  verifyDendreoWebhookSignature,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await handleEnrolmentWebhook(req.body);
    res.json(result);
  }),
);

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
