import { QuestionType } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../shared/errors';

// ─── Admin ────────────────────────────────────────────────────────────────────

interface QuestionInput {
  text: string;
  type: 'mcq' | 'truefalse' | 'short';
  points?: number;
  choices?: Array<{ text: string; isCorrect: boolean }>;
}

/**
 * Crée ou remplace entièrement le quiz d'une UA.
 * Supprime les anciennes questions/choix et recrée tout.
 */
export async function upsertQuiz(uaId: string, questions: QuestionInput[]) {
  const ua = await prisma.uA.findUnique({ where: { id: uaId } });
  if (!ua) throw new NotFoundError('UA');
  if (ua.type !== 'quiz') throw new BadRequestError("Cette UA n'est pas de type quiz");

  // Upsert le quiz
  const quiz = await prisma.quiz.upsert({
    where: { uaId },
    update: { title: ua.title },
    create: { uaId, title: ua.title },
  });

  // Supprimer toutes les anciennes questions (cascade les choix)
  await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });

  // Créer les nouvelles questions + choix
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const question = await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        questionText: q.text,
        type: q.type as QuestionType,
        position: i,
        points: q.points ?? 1,
      },
    });

    if (q.choices && q.choices.length > 0) {
      await prisma.quizChoice.createMany({
        data: q.choices.map((c) => ({
          questionId: question.id,
          choiceText: c.text,
          isCorrect: c.isCorrect,
        })),
      });
    }
  }

  return getQuizAdmin(uaId);
}

/** Retourne le quiz complet pour l'admin (avec isCorrect). */
export async function getQuizAdmin(uaId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { uaId },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: { choices: true },
      },
    },
  });
  if (!quiz) throw new NotFoundError('Quiz');

  return {
    id: quiz.id,
    uaId: quiz.uaId,
    title: quiz.title,
    instructions: quiz.instructions,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.questionText,
      type: q.type,
      position: q.position,
      points: q.points,
      choices: q.choices.map((c) => ({
        id: c.id,
        text: c.choiceText,
        isCorrect: c.isCorrect,
      })),
    })),
  };
}

// ─── Player ───────────────────────────────────────────────────────────────────

/** Retourne le quiz SANS les isCorrect. */
export async function getQuizForPlayer(uaId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { uaId },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: { choices: true },
      },
    },
  });
  if (!quiz) throw new NotFoundError('Quiz');

  return {
    id: quiz.id,
    title: quiz.title,
    instructions: quiz.instructions,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      text: q.questionText,
      type: q.type,
      position: q.position,
      points: q.points,
      choices: q.choices.map((c) => ({
        id: c.id,
        text: c.choiceText,
        // isCorrect volontairement omis
      })),
    })),
  };
}

interface AnswerInput {
  questionId: string;
  choiceIds?: string[];
  textAnswer?: string;
}

/**
 * Soumet une tentative de quiz.
 * - Score calculé pour MCQ/truefalse
 * - Déclaratif pour short
 * - Marque l'UA comme completed (quiz jamais bloquant)
 */
export async function submitQuizAttempt(
  enrollmentId: string,
  uaId: string,
  answers: AnswerInput[],
) {
  const quiz = await prisma.quiz.findUnique({
    where: { uaId },
    include: {
      questions: {
        include: { choices: true },
      },
    },
  });
  if (!quiz) throw new NotFoundError('Quiz');

  // Numéro de tentative auto-incrémenté
  const lastAttempt = await prisma.quizAttempt.findFirst({
    where: { enrollmentId, quizId: quiz.id },
    orderBy: { attemptNumber: 'desc' },
  });
  const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

  // Calculer le score
  let totalPoints = 0;
  let earnedPoints = 0;
  const answerRecords: Array<{
    questionId: string;
    selectedChoiceId: string | null;
    shortAnswerText: string | null;
    isCorrect: boolean | null;
  }> = [];

  for (const answer of answers) {
    const question = quiz.questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    if (question.type === 'short') {
      // Déclaratif : pas de correction
      answerRecords.push({
        questionId: question.id,
        selectedChoiceId: null,
        shortAnswerText: answer.textAnswer ?? null,
        isCorrect: null,
      });
    } else {
      // MCQ ou truefalse : vérifier le choix
      totalPoints += question.points;
      const selectedId = answer.choiceIds?.[0] ?? null;
      const correctChoice = question.choices.find((c) => c.isCorrect);
      const isCorrect = selectedId != null && selectedId === correctChoice?.id;

      if (isCorrect) earnedPoints += question.points;

      answerRecords.push({
        questionId: question.id,
        selectedChoiceId: selectedId,
        shortAnswerText: null,
        isCorrect,
      });
    }
  }

  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : null;

  // Créer la tentative + réponses en transaction
  const attempt = await prisma.$transaction(async (tx) => {
    const att = await tx.quizAttempt.create({
      data: {
        enrollmentId,
        quizId: quiz.id,
        attemptNumber,
        scorePercent,
      },
    });

    if (answerRecords.length > 0) {
      await tx.quizAnswer.createMany({
        data: answerRecords.map((a) => ({
          attemptId: att.id,
          ...a,
        })),
      });
    }

    return att;
  });

  // Marquer l'UA comme completed (quiz = soumission suffit)
  const now = new Date();
  await prisma.uAProgress.upsert({
    where: { enrollmentId_uaId: { enrollmentId, uaId } },
    update: { status: 'completed', completedAt: now },
    create: {
      enrollmentId,
      uaId,
      status: 'completed',
      firstAccessedAt: now,
      completedAt: now,
    },
  });

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    scorePercent: attempt.scorePercent,
    submittedAt: attempt.submittedAt.toISOString(),
    answers: answerRecords.map((a) => ({
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      selectedChoiceId: a.selectedChoiceId,
    })),
  };
}

/** Historique des tentatives d'un apprenant pour un quiz. */
export async function getAttempts(enrollmentId: string, uaId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { uaId } });
  if (!quiz) throw new NotFoundError('Quiz');

  const attempts = await prisma.quizAttempt.findMany({
    where: { enrollmentId, quizId: quiz.id },
    orderBy: { attemptNumber: 'desc' },
  });

  return attempts.map((a) => ({
    attemptId: a.id,
    attemptNumber: a.attemptNumber,
    scorePercent: a.scorePercent,
    submittedAt: a.submittedAt.toISOString(),
  }));
}
