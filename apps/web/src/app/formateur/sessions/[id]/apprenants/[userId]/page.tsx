'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDuration, formatDate, formatStatus } from '@/lib/formatters';
import { ProgressBar } from '@/components/progress/ProgressBar';
import type { CompletionStatus } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UADetail {
  id: string;
  title: string;
  type: string;
  status: CompletionStatus;
  timeSpentSeconds: number;
  videoPercentWatched: number;
  completedAt: string | null;
}

interface ModuleDetail {
  id: string;
  title: string;
  position: number;
  progressPercent: number;
  status: string;
  uas: UADetail[];
}

interface QuizHistoryItem {
  attemptId: string;
  quizTitle: string;
  uaId: string;
  attemptNumber: number;
  scorePercent: number | null;
  submittedAt: string;
  shortAnswers: Array<{ question: string; answer: string }>;
}

interface ApprenantData {
  user: { id: string; fullName: string; email: string };
  enrollmentId: string;
  formationTitle: string;
  status: string;
  timeSpentSeconds: number;
  modules: ModuleDetail[];
  quizHistory: QuizHistoryItem[];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ApprenantDetailPage() {
  const params = useParams<{ id: string; userId: string }>();
  const { id: formationId, userId } = params;

  const [data, setData] = useState<ApprenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!formationId || !userId) return;
    api.get<{ data: ApprenantData }>(`/formateur/sessions/${formationId}/apprenants/${userId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [formationId, userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <a href={`/formateur/sessions/${formationId}`} className="text-brand-600 text-sm font-medium">Retour</a>
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    not_started: 'Non demarre',
    in_progress: 'En cours',
    completed: 'Termine',
  };

  const statusStyles: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-brand-50 text-brand-700',
    completed: 'bg-green-50 text-green-700',
  };

  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <a
            href={`/formateur/sessions/${formationId}`}
            className="text-sm text-gray-500 hover:text-brand-700 transition-colors mb-2 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {data.formationTitle}
          </a>

          <div className="flex items-center gap-4 mt-2">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-brand-700 font-semibold text-sm">
                {data.user.fullName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.user.fullName}</h1>
              <p className="text-sm text-gray-500">{data.user.email}</p>
            </div>
            <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[data.status] || statusStyles.not_started}`}>
              {statusLabels[data.status] || data.status}
            </span>
          </div>

          <p className="text-sm text-gray-500 mt-3">
            Temps total : {formatDuration(data.timeSpentSeconds)}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ─── Progression par module ────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Progression par module</h2>
          <div className="space-y-4">
            {data.modules.map((mod) => (
              <div key={mod.id} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">
                    <span className="text-gray-400 mr-1">{mod.position + 1}.</span>
                    {mod.title}
                  </h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[mod.status] || statusStyles.not_started}`}>
                    {statusLabels[mod.status] || mod.status}
                  </span>
                </div>

                <ProgressBar percent={mod.progressPercent} size="sm" />

                <div className="mt-3 space-y-1">
                  {mod.uas.map((ua) => (
                    <div key={ua.id} className="flex items-center gap-3 py-1.5 text-sm">
                      {/* Status icon */}
                      {ua.status === 'completed' ? (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                        </svg>
                      ) : ua.status === 'in_progress' ? (
                        <div className="w-4 h-4 rounded-full border-2 border-brand-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}

                      <span className={ua.status === 'completed' ? 'text-gray-500' : 'text-gray-900'}>
                        {ua.title}
                      </span>
                      <span className="text-xs text-gray-400 capitalize ml-auto">{ua.type}</span>
                      {ua.timeSpentSeconds > 0 && (
                        <span className="text-xs text-gray-400">{formatDuration(ua.timeSpentSeconds)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Historique quiz ───────────────────────────────────────── */}
        {data.quizHistory.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique des quiz</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Quiz</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">N&deg;</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Score</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.quizHistory.map((q) => (
                    <tr key={q.attemptId}>
                      <td className="px-4 py-2.5 text-gray-900">{q.quizTitle}</td>
                      <td className="px-4 py-2.5 text-gray-500">#{q.attemptNumber}</td>
                      <td className="px-4 py-2.5">
                        {q.scorePercent !== null ? (
                          <span className={q.scorePercent >= 50 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                            {q.scorePercent}%
                          </span>
                        ) : (
                          <span className="text-gray-400">Declaratif</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">
                        {formatDate(q.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Réponses courtes */}
            {data.quizHistory.some((q) => q.shortAnswers.length > 0) && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Réponses courtes (déclaratives)</h3>
                <div className="space-y-3">
                  {data.quizHistory
                    .filter((q) => q.shortAnswers.length > 0)
                    .map((q) =>
                      q.shortAnswers.map((sa, i) => (
                        <div key={`${q.attemptId}-${i}`} className="bg-white rounded-lg border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">
                            {q.quizTitle} — Tentative #{q.attemptNumber}
                          </p>
                          <p className="text-sm font-medium text-gray-700 mb-2">{sa.question}</p>
                          <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3 italic">
                            &laquo; {sa.answer} &raquo;
                          </p>
                        </div>
                      )),
                    )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
