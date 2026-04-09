// Types frontend — miroir des DTOs API
// Les types complets sont dans packages/shared-types

export type CompletionStatus = 'not_started' | 'in_progress' | 'completed';
export type UAType = 'video' | 'quiz' | 'resource';
export type UserRole = 'learner' | 'trainer' | 'admin' | 'superadmin';

export interface FormationSummary {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  progress: {
    status: CompletionStatus;
    progressPercent: number;
    timeSpentSeconds: number;
    startDate: string;
    endDate: string;
  };
}

export interface ModuleSummary {
  id: string;
  title: string;
  position: number;
  status: CompletionStatus;
  progressPercent: number;
  isLocked: boolean;
  uas: UASummary[];
}

export interface UASummary {
  id: string;
  title: string;
  type: UAType;
  position: number;
  status: CompletionStatus;
}
