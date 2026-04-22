'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Choice {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  type: 'mcq' | 'truefalse' | 'short';
  position: number;
  points: number;
  choices: Choice[];
}

interface QuizData {
  id: string;
  title: string;
  instructions: string | null;
  questions: Question[];
}

interface SubmitResult {
  attemptNumber: number;
  scorePercent: number | null;
  submittedAt: string;
  answers: Array<{
    questionId: string;
    isCorrect: boolean | null;
  }>;
}

interface Attempt {
  attemptId: string;
  attemptNumber: number;
  scorePercent: number | null;
  submittedAt: string;
}

interface UAMeta {
  id: string;
  title: string;
  formationId: string;
  formationTitle: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const uaId = params.id;

  const [ua, setUA] = useState<UAMeta | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Answer state: questionId → selected choiceId or text
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const loadData = useCallback(async () => {
    if (!uaId) return;
    try {
      const [uaRes, quizRes, attRes] = await Promise.all([
        api.get<{ data: UAMeta }>(`/player/uas/${uaId}`),
        api.get<{ data: QuizData }>(`/player/uas/${uaId}/quiz`),
        api.get<{ data: Attempt[] }>(`/player/uas/${uaId}/quiz/attempts`),
      ]);
      setUA(uaRes.data);
      setQuiz(quizRes.data);
      setAttempts(attRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [uaId]);

  useEffect(() => { loadData(); }, [loadData]);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    if (!quiz) return;
    setSubmitting(true);

    const payload = {
      answers: quiz.questions.map((q) => {
        const val = answers[q.id] || '';
        if (q.type === 'short') {
          return { questionId: q.id, textAnswer: val };
        }
        return { questionId: q.id, choiceIds: val ? [val] : [] };
      }),
    };

    try {
      const res = await api.post<{ data: SubmitResult }>(`/player/uas/${uaId}/quiz/submit`, payload);
      setResult(res.data);
      // Refresh attempts
      const attRes = await api.get<{ data: Attempt[] }>(`/player/uas/${uaId}/quiz/attempts`);
      setAttempts(attRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de soumission');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setResult(null);
    setAnswers({});
  }

  // ─── Loading / Error ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement du quiz...
        </div>
      </div>
    );
  }

  if (error || !quiz || !ua) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Impossible de charger le quiz</h1>
          <p className="text-gray-500 mb-6">{error || 'Quiz introuvable'}</p>
          <a href="/" className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
            Retour
          </a>
        </div>
      </div>
    );
  }

  const allAnswered = quiz.questions.every((q) => {
    const val = answers[q.id];
    return val !== undefined && val !== '';
  });

  // ─── Result view ─────────────────────────────────────────────────────────

  if (result) {
    const correctMap = new Map(result.answers.map((a) => [a.questionId, a.isCorrect]));

    return (
      <div className="min-h-screen bg-light">
        <Header ua={ua} />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          {/* Score card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Quiz soumis</h2>
            {result.scorePercent !== null ? (
              <p className="text-3xl font-bold text-brand-600 mb-2">{result.scorePercent}%</p>
            ) : (
              <p className="text-lg text-gray-600 mb-2">Réponses enregistrées</p>
            )}
            <p className="text-sm text-gray-500">
              Tentative n&deg;{result.attemptNumber} — Le quiz ne bloque pas votre progression.
            </p>
          </div>

          {/* Correction detail */}
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 mb-6">
            {quiz.questions.map((q, i) => {
              const isCorrect = correctMap.get(q.id);
              return (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5">
                      {isCorrect === true && (
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                        </svg>
                      )}
                      {isCorrect === false && (
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {isCorrect === null && (
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {i + 1}. {q.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {q.type === 'short' ? 'Réponse déclarative enregistrée' : isCorrect ? 'Correct' : 'Incorrect'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm min-h-[44px]"
            >
              Recommencer
            </button>
            <a
              href={`/formations/${ua.formationId}`}
              className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm min-h-[44px]"
            >
              Retour à la formation
            </a>
          </div>

          {/* Attempts history */}
          <AttemptsHistory attempts={attempts} />
        </main>
      </div>
    );
  }

  // ─── Quiz form ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-light">
      <Header ua={ua} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Title & instructions */}
        {quiz.instructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 text-sm text-blue-800">
            {quiz.instructions}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-5 mb-8">
          {quiz.questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-900 mb-4">
                <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                {q.text}
              </p>

              {q.type === 'mcq' && (
                <div className="space-y-2">
                  {q.choices.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-[44px] ${
                        answers[q.id] === c.id
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={c.id}
                        checked={answers[q.id] === c.id}
                        onChange={() => setAnswer(q.id, c.id)}
                        className="w-5 h-5 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700">{c.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'truefalse' && (
                <div className="flex gap-3">
                  {q.choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAnswer(q.id, c.id)}
                      className={`flex-1 py-3 px-4 rounded-lg border font-medium text-sm transition-colors min-h-[44px] ${
                        answers[q.id] === c.id
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {c.text}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'short' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Votre réponse..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y"
                />
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !allAnswered}
          className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        >
          {submitting ? 'Envoi en cours...' : 'Soumettre mes réponses'}
        </button>

        {!allAnswered && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Repondez a toutes les questions pour soumettre
          </p>
        )}

        {/* Attempts history */}
        <AttemptsHistory attempts={attempts} />
      </main>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Header({ ua }: { ua: UAMeta }) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <a
          href={`/formations/${ua.formationId}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors flex-shrink-0 py-2 -my-2 min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span className="hidden sm:inline">{ua.formationTitle}</span>
          <span className="sm:hidden">Retour</span>
        </a>
        <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
        <h1 className="text-base font-semibold text-gray-900 truncate">{ua.title}</h1>
      </div>
    </header>
  );
}

function AttemptsHistory({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return null;

  return (
    <div className="mt-10">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Historique des tentatives</h3>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2.5 text-left font-medium text-gray-500">N&deg;</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-500">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {attempts.map((a) => (
              <tr key={a.attemptId}>
                <td className="px-4 py-2.5 text-gray-700">#{a.attemptNumber}</td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(a.submittedAt)}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {a.scorePercent !== null ? (
                    <span className={a.scorePercent >= 50 ? 'text-green-600' : 'text-orange-500'}>
                      {a.scorePercent}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
