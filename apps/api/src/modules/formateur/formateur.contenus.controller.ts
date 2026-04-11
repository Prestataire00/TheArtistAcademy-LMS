import { Request, Response } from 'express';
import { z } from 'zod';
import * as contenusService from './formateur.contenus.service';
import * as quizService from '../quizzes/quizzes.service';
import * as resourceService from '../resources/resources.service';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError } from '../../shared/errors';

// ─── Liste contenus editables ─────────────────────────────────────────────────

export async function listContent(req: Request, res: Response) {
  const data = await contenusService.listEditableContent(req.user!.userId);
  res.json({ data });
}

// ─── Quiz : lecture + edition ─────────────────────────────────────────────────

export async function getQuiz(req: Request, res: Response) {
  const quiz = await quizService.getQuizAdmin(req.params.uaId);
  res.json({ data: quiz });
}

const choiceSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    text: z.string().min(1).max(5000),
    type: z.enum(['mcq', 'truefalse', 'short']),
    points: z.number().int().min(1).default(1),
    choices: z.array(choiceSchema).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'mcq' || q.type === 'truefalse') {
      if (!q.choices || q.choices.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Les questions ${q.type} doivent avoir au moins un choix` });
      } else if (!q.choices.some((c) => c.isCorrect)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Les questions ${q.type} doivent avoir au moins un choix correct` });
      }
    }
    if (q.type === 'short' && q.choices && q.choices.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Les questions short ne doivent pas avoir de choix' });
    }
  });

const upsertQuizSchema = z.object({
  questions: z.array(questionSchema).min(1),
});

export async function upsertQuiz(req: Request, res: Response) {
  const uaId = req.params.uaId;
  const parsed = upsertQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  }

  const quiz = await quizService.upsertQuiz(uaId, parsed.data.questions);

  await logEvent({
    category: 'admin',
    action: 'quiz_upsert_by_trainer',
    userId: req.user!.userId,
    entityType: 'quiz',
    entityId: quiz.id,
    payload: { uaId, questionsCount: parsed.data.questions.length },
  });

  res.json({ data: quiz });
}

// ─── Ressource : upload + suppression ─────────────────────────────────────────

export async function uploadResource(req: Request, res: Response) {
  const uaId = req.params.uaId;
  const file = req.file;
  if (!file) throw new BadRequestError('Fichier manquant');

  const result = await resourceService.uploadResource(uaId, file);

  await logEvent({
    category: 'admin',
    action: 'resource_upload_by_trainer',
    userId: req.user!.userId,
    entityType: 'resource',
    entityId: result.id,
    payload: { uaId, fileName: result.fileName },
  });

  res.status(201).json({ data: result });
}

export async function deleteResource(req: Request, res: Response) {
  const uaId = req.params.uaId;
  await resourceService.deleteResource(uaId);

  await logEvent({
    category: 'admin',
    action: 'resource_delete_by_trainer',
    userId: req.user!.userId,
    entityType: 'ua',
    entityId: uaId,
  });

  res.status(204).end();
}

export async function previewResource(req: Request, res: Response) {
  const uaId = req.params.uaId;
  const result = await resourceService.generatePreviewUrlByUaId(uaId);
  res.json({ data: result });
}
