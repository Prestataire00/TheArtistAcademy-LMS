'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SlideOver } from '@/components/SlideOver';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ResourceInfo { id: string; fileName: string; fileType: string; fileSizeBytes: number | null }
interface VideoInfo { id: string; originalName: string; durationSeconds: number | null }
interface UA { id: string; moduleId: string; title: string; type: string; position: number; isPublished: boolean; resource: ResourceInfo | null; videoContent: VideoInfo | null }
interface ModuleDetail { id: string; formationId: string; title: string; description: string | null; position: number; isPublished: boolean; uas: UA[] }
interface Choice { text: string; isCorrect: boolean }
interface Question { text: string; type: 'mcq' | 'truefalse' | 'short'; points: number; choices: Choice[] }
interface QuizData { id: string; questions: Question[] }

export default function AdminModuleDetailPage() {
  const params = useParams<{ id: string; moduleId: string }>();
  const { id: formationId, moduleId } = params;

  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showUAForm, setShowUAForm] = useState(false);
  const [editingUA, setEditingUA] = useState<UA | null>(null);

  // Quiz editor state
  const [quizUaId, setQuizUaId] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!moduleId) return;
    api.get<{ data: ModuleDetail }>(`/admin/modules/${moduleId}`)
      .then((res) => setMod(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [moduleId]);

  useEffect(() => { loadData(); }, [loadData]);

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleDeleteUA(id: string, title: string) {
    if (!confirm(`Supprimer "${title}" ?`)) return;
    try { await api.delete(`/admin/uas/${id}`); flash('success', 'UA supprimee'); loadData(); }
    catch (err: unknown) { flash('error', err instanceof Error ? err.message : 'Erreur'); }
  }

  // ─── Drag & drop ──────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !mod) return;

    const oldIndex = mod.uas.findIndex((ua) => ua.id === active.id);
    const newIndex = mod.uas.findIndex((ua) => ua.id === over.id);
    const reordered = arrayMove(mod.uas, oldIndex, newIndex);

    // Optimistic update
    setMod({ ...mod, uas: reordered });

    try {
      await api.put(`/admin/modules/${moduleId}/uas/reorder`, {
        orderedIds: reordered.map((ua) => ua.id),
      });
      loadData();
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Erreur reordonnancement');
      loadData(); // Revert
    }
  }

  // ─── Quiz ──────────────────────────────────────────────────────────────

  async function openQuizEditor(uaId: string) {
    setQuizUaId(uaId);
    setQuizError(null);
    try {
      const res = await api.get<{ data: QuizData }>(`/admin/uas/${uaId}/quiz`);
      setQuizData(res.data);
    } catch {
      setQuizData({ id: '', questions: [] });
    }
  }

  function addQuestion(type: 'mcq' | 'truefalse' | 'short') {
    if (!quizData) return;
    const choices: Choice[] =
      type === 'truefalse' ? [{ text: 'Vrai', isCorrect: true }, { text: 'Faux', isCorrect: false }] :
      type === 'mcq' ? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] : [];
    setQuizData({ ...quizData, questions: [...quizData.questions, { text: '', type, points: 1, choices }] });
  }

  async function saveQuiz() {
    if (!quizData || !quizUaId) return;
    setQuizError(null);
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      if (!q.text.trim()) { setQuizError(`Q${i + 1} : texte vide`); return; }
      if (q.type !== 'short') {
        if (q.choices.some((c) => !c.text.trim())) { setQuizError(`Q${i + 1} : un choix est vide`); return; }
        if (!q.choices.some((c) => c.isCorrect)) { setQuizError(`Q${i + 1} : selectionnez la bonne reponse`); return; }
      }
    }
    try {
      await api.put(`/admin/uas/${quizUaId}/quiz`, { questions: quizData.questions });
      setQuizUaId(null); setQuizData(null);
      flash('success', 'Quiz sauvegarde');
      loadData();
    } catch (err: unknown) { setQuizError(err instanceof Error ? err.message : 'Erreur'); }
  }

  // ─── File upload ───────────────────────────────────────────────────────

  async function handleUpload(uaId: string, type: 'video' | 'resource', file: File) {
    setUploadingId(uaId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const endpoint = type === 'video' ? `/api/v1/admin/uas/${uaId}/video` : `/api/v1/admin/uas/${uaId}/resource`;
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include', body: formData });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error?.message || `HTTP ${res.status}`); }
      flash('success', type === 'video' ? 'Video uploadee' : 'Ressource uploadee');
      loadData();
    } catch (err: unknown) { flash('error', err instanceof Error ? err.message : 'Erreur upload'); }
    setUploadingId(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center gap-3 text-gray-500 py-12"><div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />Chargement...</div>;
  if (error || !mod) return <div className="text-red-600 py-12">{error}</div>;

  return (
    <div>
      {/* Header */}
      <a href={`/admin/formations/${formationId}`} className="text-sm text-gray-500 hover:text-brand-700 transition-colors inline-flex items-center gap-1 mb-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        Retour a la formation
      </a>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mod.title}</h1>
          <p className="text-sm text-gray-500">Module {mod.position + 1} — {mod.uas.length} UA{mod.uas.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEditingUA(null); setShowUAForm(true); }} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 font-medium">
          + Ajouter une UA
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>
      )}

      {/* UA form */}
      {showUAForm && (
        <UAForm
          moduleId={moduleId}
          initial={editingUA}
          onSave={() => { setShowUAForm(false); loadData(); flash('success', editingUA ? 'UA modifiee' : 'UA creee'); }}
          onCancel={() => setShowUAForm(false)}
          onError={(msg) => flash('error', msg)}
        />
      )}

      {/* Quiz editor modal */}
      {quizUaId && quizData && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Editeur de quiz</h2>
              <button onClick={() => { setQuizUaId(null); setQuizData(null); setQuizError(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {quizData.questions.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucune question.</p>}

              {quizData.questions.map((q, qi) => (
                <div key={qi} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400">Q{qi + 1} — {q.type === 'mcq' ? 'QCM' : q.type === 'truefalse' ? 'Vrai/Faux' : 'Reponse courte'}</span>
                    <button onClick={() => setQuizData({ ...quizData, questions: quizData.questions.filter((_, i) => i !== qi) })} className="text-red-400 hover:text-red-600 text-xs">Supprimer</button>
                  </div>
                  <input type="text" value={q.text} onChange={(e) => { const qs = [...quizData.questions]; qs[qi] = { ...qs[qi], text: e.target.value }; setQuizData({ ...quizData, questions: qs }); }}
                    placeholder="Texte de la question..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500" />

                  {q.type === 'mcq' && (
                    <div className="space-y-2 mb-2">
                      {q.choices.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          <input type="radio" name={`q${qi}`} checked={c.isCorrect}
                            onChange={() => { const qs = [...quizData.questions]; qs[qi] = { ...qs[qi], choices: qs[qi].choices.map((ch, i) => ({ ...ch, isCorrect: i === ci })) }; setQuizData({ ...quizData, questions: qs }); }}
                            className="w-4 h-4 accent-green-600" />
                          <input type="text" value={c.text}
                            onChange={(e) => { const qs = [...quizData.questions]; qs[qi] = { ...qs[qi], choices: qs[qi].choices.map((ch, i) => i === ci ? { ...ch, text: e.target.value } : ch) }; setQuizData({ ...quizData, questions: qs }); }}
                            placeholder={`Choix ${ci + 1}...`}
                            className={`flex-1 px-2 py-1.5 border rounded text-sm ${c.isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'}`} />
                          <button onClick={() => { const qs = [...quizData.questions]; qs[qi] = { ...qs[qi], choices: qs[qi].choices.filter((_, i) => i !== ci) }; setQuizData({ ...quizData, questions: qs }); }} className="text-red-400 text-xs">x</button>
                        </div>
                      ))}
                      <button onClick={() => { const qs = [...quizData.questions]; qs[qi] = { ...qs[qi], choices: [...qs[qi].choices, { text: '', isCorrect: false }] }; setQuizData({ ...quizData, questions: qs }); }}
                        className="text-xs text-brand-600">+ Ajouter un choix</button>
                    </div>
                  )}

                  {q.type === 'truefalse' && (
                    <div className="flex gap-3 mb-2">
                      {q.choices.map((c, ci) => (
                        <button key={ci} type="button"
                          onClick={() => { const qs = [...quizData.questions]; qs[qi] = { ...qs[qi], choices: qs[qi].choices.map((ch, i) => ({ ...ch, isCorrect: i === ci })) }; setQuizData({ ...quizData, questions: qs }); }}
                          className={`flex-1 py-2.5 rounded-lg border font-medium text-sm ${c.isCorrect ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                          {c.text} {c.isCorrect && <span className="ml-1 text-green-500">&#10003;</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'short' && <p className="text-xs text-gray-400 italic">Reponse libre declarative</p>}
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <button onClick={() => addQuestion('mcq')} className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">+ QCM</button>
                <button onClick={() => addQuestion('truefalse')} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">+ Vrai/Faux</button>
                <button onClick={() => addQuestion('short')} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">+ Reponse courte</button>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              {quizError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{quizError}</div>}
              <div className="flex justify-end gap-3">
                <button onClick={() => { setQuizUaId(null); setQuizData(null); setQuizError(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                <button onClick={saveQuiz} disabled={quizData.questions.length === 0} className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UAs list with drag & drop */}
      {mod.uas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucune UA. Ajoutez du contenu a ce module.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={mod.uas.map((ua) => ua.id)} strategy={verticalListSortingStrategy}>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-10 px-2 py-3" />
                    <th className="px-4 py-3 text-left font-medium text-gray-500">UA</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Fichier</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 hidden md:table-cell">Publie</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mod.uas.map((ua) => (
                    <SortableUARow
                      key={ua.id}
                      ua={ua}
                      uploadingId={uploadingId}
                      onOpenQuiz={() => openQuizEditor(ua.id)}
                      onUpload={(type, file) => handleUpload(ua.id, type, file)}
                      onDelete={() => handleDeleteUA(ua.id, ua.title)}
                      onUpdate={() => { loadData(); }}
                      onFlash={flash}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── Sortable UA row ─────────────────────────────────────────────────────────

function SortableUARow(props: {
  ua: UA; uploadingId: string | null; onOpenQuiz: () => void;
  onUpload: (type: 'video' | 'resource', file: File) => void;
  onDelete: () => void; onUpdate: () => void; onFlash: (type: 'success' | 'error', text: string) => void;
}) {
  const { ua, uploadingId, onOpenQuiz, onUpload, onDelete, onUpdate, onFlash } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ua.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ua.title);

  async function saveTitle() {
    if (!editTitle.trim() || editTitle.trim() === ua.title) { setEditing(false); setEditTitle(ua.title); return; }
    try { await api.put(`/admin/uas/${ua.id}`, { title: editTitle.trim() }); setEditing(false); onUpdate(); }
    catch (err: unknown) { onFlash('error', err instanceof Error ? err.message : 'Erreur'); }
  }

  async function handleTogglePublish() {
    try { await api.put(`/admin/uas/${ua.id}`, { isPublished: !ua.isPublished }); onUpdate(); }
    catch (err: unknown) { onFlash('error', err instanceof Error ? err.message : 'Erreur'); }
  }

  const typeLabels: Record<string, string> = { video: 'Video', quiz: 'Quiz', resource: 'Ressource' };
  const fileName = ua.resource?.fileName || ua.videoContent?.originalName || '—';

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      <td className="w-10 px-2 py-3 text-center">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none" title="Glisser pour reordonner">
          <span className="text-lg leading-none">&#10303;</span>
        </button>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditing(false); setEditTitle(ua.title); } }}
            onBlur={saveTitle} autoFocus
            className="px-2 py-1 border border-brand-300 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 w-full" />
        ) : (
          <p onClick={() => { setEditTitle(ua.title); setEditing(true); }} className="font-medium text-gray-900 cursor-pointer hover:underline hover:decoration-gray-300">{ua.title}</p>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className={`text-xs px-2 py-0.5 rounded-full ${ua.type === 'video' ? 'bg-purple-50 text-purple-600' : ua.type === 'quiz' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{typeLabels[ua.type] || ua.type}</span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px] hidden md:table-cell">{fileName}</td>
      <td className="px-4 py-3 hidden md:table-cell text-center"><Toggle checked={ua.isPublished} onChange={handleTogglePublish} /></td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {ua.type === 'quiz' && <button onClick={onOpenQuiz} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Editer quiz</button>}
          {ua.type === 'resource' && (
            <>
              {ua.resource && (
                <>
                  <button onClick={async () => { try { const r = await api.get<{data:{signedUrl:string}}>(`/admin/resources/${ua.id}/preview`); window.open(r.data.signedUrl, '_blank'); } catch {} }} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Voir</button>
                  <button onClick={async () => { try { const r = await api.get<{data:{signedUrl:string;fileName:string}}>(`/admin/resources/${ua.id}/preview`); const a=document.createElement('a');a.href=r.data.signedUrl;a.download=r.data.fileName;document.body.appendChild(a);a.click();document.body.removeChild(a); } catch {} }} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Telecharger</button>
                </>
              )}
              <label className="px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded cursor-pointer">
                {uploadingId === ua.id ? <span className="inline-block w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /> : (ua.resource ? 'Remplacer' : 'Uploader')}
                <input type="file" accept=".pdf,.ppt,.pptx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload('resource', f); e.target.value = ''; }} />
              </label>
            </>
          )}
          {ua.type === 'video' && (
            <>
              {ua.videoContent && (
                <>
                  <button onClick={async () => { try { const r = await api.get<{data:{signedUrl:string}}>(`/admin/videos/${ua.id}/preview`); window.open(r.data.signedUrl, '_blank'); } catch {} }} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Voir</button>
                  <button onClick={async () => { try { const r = await api.get<{data:{signedUrl:string}}>(`/admin/videos/${ua.id}/preview`); const a=document.createElement('a');a.href=r.data.signedUrl;a.download=ua.videoContent!.originalName;document.body.appendChild(a);a.click();document.body.removeChild(a); } catch {} }} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Telecharger</button>
                </>
              )}
              <label className="px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded cursor-pointer">
                {uploadingId === ua.id ? <span className="inline-block w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /> : (ua.videoContent ? 'Remplacer' : 'Uploader')}
                <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload('video', f); e.target.value = ''; }} />
              </label>
            </>
          )}
          <button onClick={onDelete} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">Supprimer</button>
        </div>
      </td>
    </tr>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'ml-[18px]' : 'ml-[3px]'}`} />
    </button>
  );
}

// ─── UA form ─────────────────────────────────────────────────────────────────

function UAForm({ moduleId, initial, onSave, onCancel, onError }: {
  moduleId: string; initial: UA | null; onSave: () => void; onCancel: () => void; onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState(initial?.type ?? 'video');
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { onError('Le titre est requis'); return; }
    setSaving(true);
    try {
      if (initial) {
        await api.put(`/admin/uas/${initial.id}`, { title, isPublished });
      } else {
        await api.post('/admin/uas', { moduleId, title, type, isPublished });
      }
      onSave();
    } catch (err: unknown) { onError(err instanceof Error ? err.message : 'Erreur'); }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="font-semibold text-gray-900 mb-4">{initial ? 'Modifier l\'UA' : 'Nouvelle UA'}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        {!initial && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setType('video')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  type === 'video' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>Video</button>
              <button type="button" onClick={() => setType('quiz')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  type === 'quiz' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>Quiz</button>
              <button type="button" onClick={() => setType('resource')}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  type === 'resource' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>Ressource</button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} id="ua-pub" className="w-4 h-4" />
          <label htmlFor="ua-pub" className="text-sm text-gray-700">Publiee</label>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
        </div>
      </form>
    </div>
  );
}
