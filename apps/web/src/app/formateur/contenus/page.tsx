'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Choice { text: string; isCorrect: boolean }
interface Question { id?: string; text: string; type: 'mcq' | 'truefalse' | 'short'; points: number; choices: Choice[] }
interface QuizData { id: string; uaId: string; title: string; questions: Question[] }

interface ResourceInfo { id: string; fileName: string; fileType: string; fileSizeBytes: number | null }
interface UAContent {
  id: string; title: string; type: 'quiz' | 'resource';
  quiz: { id: string; questionsCount: number } | null;
  resource: ResourceInfo | null;
}
interface ModuleContent { moduleId: string; title: string; uas: UAContent[] }
interface FormationContent { formationId: string; title: string; modules: ModuleContent[] }

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FormateurContenusPage() {
  const [formations, setFormations] = useState<FormationContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edition states
  const [editingQuizUaId, setEditingQuizUaId] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [uploadingUaId, setUploadingUaId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    api.get<{ data: FormationContent[] }>('/formateur/contenus')
      .then((res) => setFormations(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Quiz editing ──────────────────────────────────────────────────────

  async function openQuizEditor(uaId: string) {
    setEditingQuizUaId(uaId);
    setQuizLoading(true);
    try {
      const res = await api.get<{ data: QuizData }>(`/formateur/contenus/uas/${uaId}/quiz`);
      setQuizData(res.data);
    } catch {
      // Quiz doesn't exist yet — empty form
      setQuizData({ id: '', uaId, title: '', questions: [] });
    }
    setQuizLoading(false);
  }

  function addQuestion(type: 'mcq' | 'truefalse' | 'short') {
    if (!quizData) return;
    const choices: Choice[] =
      type === 'truefalse' ? [{ text: 'Vrai', isCorrect: true }, { text: 'Faux', isCorrect: false }] :
      type === 'mcq' ? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] :
      [];
    const newQ: Question = { text: '', type, points: 1, choices };
    setQuizData({ ...quizData, questions: [...quizData.questions, newQ] });
  }

  function updateQuestion(idx: number, field: string, value: string | number) {
    if (!quizData) return;
    const qs = [...quizData.questions];
    (qs[idx] as any)[field] = value;
    setQuizData({ ...quizData, questions: qs });
  }

  function removeQuestion(idx: number) {
    if (!quizData) return;
    setQuizData({ ...quizData, questions: quizData.questions.filter((_, i) => i !== idx) });
  }

  function addChoice(qIdx: number) {
    if (!quizData) return;
    const qs = [...quizData.questions];
    qs[qIdx].choices.push({ text: '', isCorrect: false });
    setQuizData({ ...quizData, questions: qs });
  }

  function updateChoice(qIdx: number, cIdx: number, field: string, value: string | boolean) {
    if (!quizData) return;
    const qs = [...quizData.questions];
    (qs[qIdx].choices[cIdx] as any)[field] = value;
    setQuizData({ ...quizData, questions: qs });
  }

  function removeChoice(qIdx: number, cIdx: number) {
    if (!quizData) return;
    const qs = [...quizData.questions];
    qs[qIdx].choices = qs[qIdx].choices.filter((_, i) => i !== cIdx);
    setQuizData({ ...quizData, questions: qs });
  }

  async function saveQuiz() {
    if (!quizData || !editingQuizUaId) return;

    // Validation locale
    setQuizError(null);
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      if (!q.text.trim()) {
        setQuizError(`Question ${i + 1} : le texte est vide`);
        return;
      }
      if (q.type !== 'short') {
        if (q.choices.some((c) => !c.text.trim())) {
          setQuizError(`Question ${i + 1} : un choix est vide`);
          return;
        }
        if (!q.choices.some((c) => c.isCorrect)) {
          setQuizError(`Question ${i + 1} : selectionnez la bonne reponse`);
          return;
        }
      }
    }

    try {
      await api.put(`/formateur/contenus/uas/${editingQuizUaId}/quiz`, {
        questions: quizData.questions,
      });
      setQuizError(null);
      setEditingQuizUaId(null);
      setQuizData(null);
      setMessage({ type: 'success', text: 'Quiz sauvegarde' });
      setTimeout(() => setMessage(null), 3000);
      loadData();
    } catch (err: unknown) {
      setQuizError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    }
  }

  // ─── Resource upload ───────────────────────────────────────────────────

  async function handleResourceUpload(uaId: string, file: File) {
    setUploadingUaId(uaId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/formateur/contenus/uas/${uaId}/resource`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      setMessage({ type: 'success', text: 'Ressource uploadee' });
      loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur upload' });
    }
    setUploadingUaId(null);
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleResourceDelete(uaId: string) {
    if (!confirm('Supprimer cette ressource ?')) return;
    try {
      await api.delete(`/formateur/contenus/uas/${uaId}/resource`);
      setMessage({ type: 'success', text: 'Ressource supprimee' });
      loadData();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    }
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleResourcePreview(uaId: string) {
    try {
      const res = await api.get<{ data: { signedUrl: string } }>(`/formateur/contenus/uas/${uaId}/resource/preview`);
      window.open(res.data.signedUrl, '_blank');
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <a href="/formateur/sessions" className="text-brand-600 text-sm">Retour</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <a href="/formateur/sessions" className="text-sm text-gray-500 hover:text-brand-700 transition-colors mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Mes sessions
          </a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Gestion des contenus</h1>
          <p className="text-sm text-gray-500 mt-1">Modifier les quiz et ressources de vos formations</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Toast message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Quiz editor modal */}
        {editingQuizUaId && (
          <QuizEditor
            loading={quizLoading}
            quizData={quizData}
            error={quizError}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onRemoveQuestion={removeQuestion}
            onAddChoice={addChoice}
            onUpdateChoice={updateChoice}
            onRemoveChoice={removeChoice}
            onSave={saveQuiz}
            onClose={() => { setEditingQuizUaId(null); setQuizData(null); setQuizError(null); }}
          />
        )}

        {formations.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-400">Aucun contenu editable</p>
          </div>
        ) : (
          <div className="space-y-8">
            {formations.map((f) => (
              <div key={f.formationId}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{f.title}</h2>
                {f.modules.map((mod) => (
                  <div key={mod.moduleId} className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">{mod.title}</h3>
                    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {mod.uas.map((ua) => (
                        <div key={ua.id} className="px-5 py-4 flex items-center gap-4">
                          {/* Icon */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                            ua.type === 'quiz' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {ua.type === 'quiz' ? '?' : 'PDF'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{ua.title}</p>
                            <p className="text-xs text-gray-400">
                              {ua.type === 'quiz'
                                ? ua.quiz ? `${ua.quiz.questionsCount} question${ua.quiz.questionsCount > 1 ? 's' : ''}` : 'Aucune question'
                                : ua.resource ? ua.resource.fileName : 'Aucun fichier'
                              }
                            </p>
                          </div>

                          {/* Actions */}
                          {ua.type === 'quiz' ? (
                            <button
                              onClick={() => openQuizEditor(ua.id)}
                              className="px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            >
                              Modifier le quiz
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <label className="px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer">
                                {uploadingUaId === ua.id ? (
                                  <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                  ua.resource ? 'Remplacer' : 'Uploader'
                                )}
                                <input
                                  type="file"
                                  accept=".pdf,.ppt,.pptx"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleResourceUpload(ua.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              {ua.resource && (
                                <>
                                <button
                                  onClick={() => handleResourcePreview(ua.id)}
                                  className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  Voir
                                </button>
                                <button
                                  onClick={() => handleResourceDelete(ua.id)}
                                  className="px-2 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  Supprimer
                                </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Quiz editor component ───────────────────────────────────────────────────

function QuizEditor({
  loading, quizData, error, onAddQuestion, onUpdateQuestion, onRemoveQuestion,
  onAddChoice, onUpdateChoice, onRemoveChoice, onSave, onClose,
}: {
  loading: boolean;
  quizData: QuizData | null;
  error: string | null;
  onAddQuestion: (type: 'mcq' | 'truefalse' | 'short') => void;
  onUpdateQuestion: (idx: number, field: string, value: string | number) => void;
  onRemoveQuestion: (idx: number) => void;
  onAddChoice: (qIdx: number) => void;
  onUpdateChoice: (qIdx: number, cIdx: number, field: string, value: string | boolean) => void;
  onRemoveChoice: (qIdx: number, cIdx: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!quizData) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Editeur de quiz</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {quizData.questions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Aucune question. Ajoutez-en une ci-dessous.</p>
          )}

          {quizData.questions.map((q, qi) => (
            <div key={qi} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-xs font-medium text-gray-400 mt-1">
                  Q{qi + 1} — {q.type === 'mcq' ? 'QCM' : q.type === 'truefalse' ? 'Vrai/Faux' : 'Reponse courte'}
                </span>
                <button onClick={() => onRemoveQuestion(qi)} className="text-red-400 hover:text-red-600 text-xs">Supprimer</button>
              </div>

              <input
                type="text"
                value={q.text}
                onChange={(e) => onUpdateQuestion(qi, 'text', e.target.value)}
                placeholder="Texte de la question..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              {/* ─── QCM : choix editables + radio pour la bonne reponse ─── */}
              {q.type === 'mcq' && (
                <div className="space-y-2 mb-2">
                  {q.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={c.isCorrect}
                        onChange={() => {
                          // Un seul choix correct : decocher les autres
                          q.choices.forEach((_, idx) => onUpdateChoice(qi, idx, 'isCorrect', idx === ci));
                        }}
                        className="w-4 h-4 text-green-600 accent-green-600"
                        title="Bonne reponse"
                      />
                      <input
                        type="text"
                        value={c.text}
                        onChange={(e) => onUpdateChoice(qi, ci, 'text', e.target.value)}
                        placeholder={`Choix ${ci + 1}...`}
                        className={`flex-1 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                          c.isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'
                        }`}
                      />
                      <button onClick={() => onRemoveChoice(qi, ci)} className="text-red-400 hover:text-red-600 text-xs">x</button>
                    </div>
                  ))}
                  <button onClick={() => onAddChoice(qi)} className="text-xs text-brand-600 hover:text-brand-700">+ Ajouter un choix</button>
                </div>
              )}

              {/* ─── Vrai/Faux : deux boutons fixes, clic pour selectionner ─── */}
              {q.type === 'truefalse' && (
                <div className="flex gap-3 mb-2">
                  {q.choices.map((c, ci) => (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => {
                        q.choices.forEach((_, idx) => onUpdateChoice(qi, idx, 'isCorrect', idx === ci));
                      }}
                      className={`flex-1 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                        c.isCorrect
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {c.text}
                      {c.isCorrect && <span className="ml-1.5 text-green-500">&#10003;</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* ─── Reponse courte : pas de choix ─── */}
              {q.type === 'short' && (
                <p className="text-xs text-gray-400 italic">Reponse libre — enregistree en declaratif, sans auto-correction</p>
              )}
            </div>
          ))}

          {/* Add question buttons */}
          <div className="flex gap-2 pt-2">
            <button onClick={() => onAddQuestion('mcq')} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">+ QCM</button>
            <button onClick={() => onAddQuestion('truefalse')} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">+ Vrai/Faux</button>
            <button onClick={() => onAddQuestion('short')} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">+ Reponse courte</button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={quizData.questions.length === 0}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
