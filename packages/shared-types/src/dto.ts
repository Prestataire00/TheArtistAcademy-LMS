import type { CompletionStatus, UAType, UserRole } from './enums';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SsoRequestDto {
  token: string;
}

export interface SsoResponseDto {
  redirectUrl: string;
  enrollmentId: string;
}

export interface AuthMeDto {
  userId: string;
  email: string;
  role: UserRole;
}

// ─── Progression ──────────────────────────────────────────────────────────────

export interface VideoProgressDto {
  uaId: string;
  enrollmentId: string;
  positionSeconds: number;
  percentWatched: number;
}

export interface UAProgressDto {
  uaId: string;
  type: UAType;
  status: CompletionStatus;
  videoPositionSeconds?: number;
  videoPercentWatched?: number;
  timeSpentSeconds: number;
  completedAt?: string;
}

export interface ModuleProgressDto {
  moduleId: string;
  title: string;
  position: number;
  status: CompletionStatus;
  progressPercent: number;
  isLocked: boolean;
  uas: UAProgressDto[];
}

export interface FormationProgressDto {
  enrollmentId: string;
  formationId: string;
  title: string;
  status: CompletionStatus;
  progressPercent: number;
  timeSpentSeconds: number;
  startDate: string;
  endDate: string;
  modules: ModuleProgressDto[];
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizChoiceDto {
  id: string;
  choiceText: string;
}

export interface QuizQuestionDto {
  id: string;
  questionText: string;
  type: 'mcq' | 'truefalse' | 'short';
  position: number;
  choices: QuizChoiceDto[];
}

export interface QuizDto {
  id: string;
  title: string;
  instructions?: string;
  questions: QuizQuestionDto[];
}

export interface QuizSubmitDto {
  answers: Array<{
    questionId: string;
    selectedChoiceId?: string;
    shortAnswerText?: string;
  }>;
}

export interface QuizResultDto {
  attemptNumber: number;
  scorePercent: number | null;
  submittedAt: string;
  answers: Array<{
    questionId: string;
    isCorrect: boolean | null;
    correctChoiceId?: string;
  }>;
}
