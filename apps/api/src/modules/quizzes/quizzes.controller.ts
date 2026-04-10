import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './quizzes.service';
import { verifyLearnerAccess } from '../../shared/enrollment.guard';
import { logEvent } from '../../shared/eventLog.service';
import { BadRequestError } from '../../shared/errors';

// ─── Validation schemas ───────────────────────────────────────────────────────

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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Les questions ${q.type} doivent avoir au moins un choix`,
        });
      } else if (!q.choices.some((c) => c.isCorrect)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Les questions ${q.type} doivent avoir au moins un choix correct`,
        });
      }
    }
    if (q.type === 'short' && q.choices && q.choices.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Les questions short ne doivent pas avoir de choix',
      });
    }
  });

const upsertQuizSchema = z.object({
  questions: z.array(questionSchema).min(1),
});

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      choiceIds: z.array(z.string().min(1)).optional(),
      textAnswer: z.string().max(10000).optional(),
    }),
  ).min(1),
});

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminUpsertQuiz(req: Request, res: Response) {
  const uaId = req.params.id;
  const parsed = upsertQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  }

  const quiz = await service.upsertQuiz(uaId, parsed.data.questions);

  await logEvent({
    category: 'admin',
    action: 'quiz_upsert',
    userId: req.user!.userId,
    entityType: 'quiz',
    entityId: quiz.id,
    payload: { uaId, questionsCount: parsed.data.questions.length },
  });

  res.json({ data: quiz });
}

// ─── Player ───────────────────────────────────────────────────────────────────

export async function playerGetQuiz(req: Request, res: Response) {
  const uaId = req.params.id;
  await verifyLearnerAccess(req.user!.userId, uaId);

  const quiz = await service.getQuizForPlayer(uaId);
  res.json({ data: quiz });
}

export async function playerSubmit(req: Request, res: Response) {
  const uaId = req.params.id;
  const userId = req.user!.userId;

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { enrollment } = await verifyLearnerAccess(userId, uaId);

  const result = await service.submitQuizAttempt(
    enrollment.id,
    uaId,
    parsed.data.answers,
  );

  await logEvent({
    category: 'quiz',
    action: 'quiz_submit',
    userId,
    enrollmentId: enrollment.id,
    entityType: 'quiz',
    entityId: result.attemptId,
    payload: {
      uaId,
      attemptNumber: result.attemptNumber,
      scorePercent: result.scorePercent,
    },
  });

  res.status(201).json({ data: result });
}

export async function playerGetAttempts(req: Request, res: Response) {
  const uaId = req.params.id;
  const userId = req.user!.userId;

  const { enrollment } = await verifyLearnerAccess(userId, uaId);
  const attempts = await service.getAttempts(enrollment.id, uaId);

  res.json({ data: attempts });
}
