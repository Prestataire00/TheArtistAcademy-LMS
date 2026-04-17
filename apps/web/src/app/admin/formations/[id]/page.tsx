'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SlideOver } from '@/components/SlideOver';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '@/components/admin/ToastContext';

interface UA { id: string; title: string; type: string; position: number; isPublished: boolean }
interface Module { id: string; formationId: string; title: string; description: string | null; position: number; isPublished: boolean; uas: UA[] }
interface FormationDetail {
  id: string; title: string; description: string | null; pathwayMode: string;
  videoCompletionThreshold: number; isPublished: boolean; modules: Module[];
}

export default function AdminFormationDetailPage() {
  const params = useParams<{ id: string }>();
  const formationId = params.id;

  const [formation, setFormation] = useState<FormationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const { showToast } = useToast();

  const loadData = useCallback(() => {
    if (!formationId) return;
    api.get<{ data: FormationDetail }>(`/admin/formations/${formationId}`)
      .then((res) => setFormation(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [formationId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDeleteModule(id: string, title: string) {
    if (!confirm(`Supprimer le module "${title}" et toutes ses UAs ?`)) return;
    try {
      await api.delete(`/admin/modules/${id}`);
      showToast('Module supprimé', 'success');
      loadData();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  async function handleDuplicateModule(id: string) {
    try {
      await api.post(`/admin/modules/${id}/duplicate`);
      showToast('Module dupliqué', 'success');
      loadData();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !formation) return;

    const oldIndex = formation.modules.findIndex((m) => m.id === active.id);
    const newIndex = formation.modules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(formation.modules, oldIndex, newIndex);

    setFormation({ ...formation, modules: reordered });

    try {
      await api.put(`/admin/formations/${formationId}/modules/reorder`, {
        orderedIds: reordered.map((m) => m.id),
      });
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
      loadData();
    }
  }

  if (loading) return <div className="flex items-center gap-3 text-gray-500 py-12"><div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />Chargement...</div>;
  if (error || !formation) return <div className="text-red-600 py-12">{error}</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <a href="/admin/formations" className="text-sm text-gray-500 hover:text-brand-700 transition-colors inline-flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Formations
        </a>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{formation.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className={`px-2 py-0.5 rounded-full text-xs ${formation.pathwayMode === 'linear' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                {formation.pathwayMode === 'linear' ? 'Linéaire' : 'Libre'}
              </span>
              <span>Seuil : {formation.videoCompletionThreshold}%</span>
              <span>{formation.isPublished ? 'Publiée' : 'Brouillon'}</span>
            </div>
          </div>
          <button
            onClick={() => { setEditingModule(null); setShowModuleForm(true); }}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            + Ajouter un module
          </button>
        </div>
      </div>

      {/* Module slide-over */}
      {showModuleForm && (
        <ModuleSlideOver
          formationId={formationId}
          initial={editingModule}
          onSave={() => { setShowModuleForm(false); setEditingModule(null); loadData(); showToast(editingModule ? 'Module modifié' : 'Module créé', 'success'); }}
          onClose={() => { setShowModuleForm(false); setEditingModule(null); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Modules list with drag & drop */}
      {formation.modules.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucun module. Ajoutez-en un pour structurer votre formation.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={formation.modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="w-10 px-2 py-3" />
                    <th className="px-4 py-3 text-left font-medium text-gray-500" style={{ width: 300, maxWidth: 300 }}>Module</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">UAs</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 hidden md:table-cell">Publié</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formation.modules.map((mod) => (
                    <SortableModuleRow key={mod.id} mod={mod} formationId={formationId}
                      onEdit={() => { setEditingModule(mod); setShowModuleForm(true); }}
                      onDuplicate={() => handleDuplicateModule(mod.id)}
                      onDelete={() => handleDeleteModule(mod.id, mod.title)}
                      onTogglePublish={async () => { try { await api.put(`/admin/modules/${mod.id}`, { isPublished: !mod.isPublished }); loadData(); } catch {} }}
                      onUpdate={loadData}
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

// ─── Sortable module row ─────────────────────────────────────────────────────

function SortableModuleRow({ mod, formationId, onEdit, onDuplicate, onDelete, onTogglePublish, onUpdate }: {
  mod: Module; formationId: string;
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onTogglePublish: () => void; onUpdate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(mod.title);

  async function saveTitle() {
    if (!editTitle.trim() || editTitle.trim() === mod.title) { setEditing(false); setEditTitle(mod.title); return; }
    try { await api.put(`/admin/modules/${mod.id}`, { title: editTitle.trim() }); setEditing(false); onUpdate(); }
    catch { setEditing(false); setEditTitle(mod.title); }
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      <td className="w-10 px-2 py-3 text-center">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none" title="Glisser pour réordonner">
          <span className="text-lg leading-none">&#10303;</span>
        </button>
      </td>
      <td className="px-4 py-3" style={{ width: 300, maxWidth: 300 }}>
        {editing ? (
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditing(false); setEditTitle(mod.title); } }}
            onBlur={saveTitle} autoFocus
            className="px-2 py-1 border border-brand-300 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 w-full box-border" />
        ) : (
          <p onClick={() => { setEditTitle(mod.title); setEditing(true); }} className="font-medium text-gray-900 cursor-pointer hover:underline hover:decoration-gray-300 truncate">{mod.title}</p>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{mod.uas.length}</td>
      <td className="px-4 py-3 hidden md:table-cell text-center">
        <Toggle checked={mod.isPublished} onChange={onTogglePublish} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <a href={`/admin/formations/${formationId}/modules/${mod.id}`} className="px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded font-medium">Gérer les UAs</a>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Modifier">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
          <button onClick={onDuplicate} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Dupliquer</button>
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

// ─── Module slide-over form ──────────────────────────────────────────────────

function ModuleSlideOver({ formationId, initial, onSave, onClose, onError }: {
  formationId: string; initial: Module | null; onSave: () => void; onClose: () => void; onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) { onError('Le titre est requis'); return; }
    setSaving(true);
    try {
      if (initial) { await api.put(`/admin/modules/${initial.id}`, { title, description: description || undefined, isPublished }); }
      else { await api.post('/admin/modules', { formationId, title, description: description || undefined, isPublished }); }
      onSave();
    } catch (err: unknown) { onError(err instanceof Error ? err.message : 'Erreur'); }
    setSaving(false);
  }

  return (
    <SlideOver title={initial ? 'Modifier le module' : 'Nouveau module'} onClose={onClose}
      footer={<div className="flex gap-3"><button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button><button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div>}>
      <div className="space-y-5">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y" /></div>
        <div className="flex items-center gap-3"><Toggle checked={isPublished} onChange={() => setIsPublished(!isPublished)} /><span className="text-sm text-gray-700">{isPublished ? 'Publié' : 'Brouillon'}</span></div>
      </div>
    </SlideOver>
  );
}
