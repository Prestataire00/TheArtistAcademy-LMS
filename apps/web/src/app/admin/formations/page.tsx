'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { SlideOver } from '@/components/SlideOver';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/admin/ToastContext';
import { ResponsiveList } from '@/components/ResponsiveList';
import { SearchInput } from '@/components/SearchInput';
import { SortableHeader } from '@/components/SortableHeader';
import { FilterPanel } from '@/components/FilterPanel';
import { Pagination } from '@/components/Pagination';
import { matchesSearch } from '@/lib/search';
import { useTableState, sortItems, type FilterDef } from '@/lib/useTableState';

interface Formation {
  id: string;
  title: string;
  description: string | null;
  pathwayMode: string;
  videoCompletionThreshold: number;
  isPublished: boolean;
  trainerId: string | null;
  trainerName: string | null;
  modulesCount: number;
  enrollmentsCount: number;
  createdAt: string;
}

const NO_TRAINER_VALUE = '__none__';

const SORT_ACCESSORS: Record<string, (f: Formation) => unknown> = {
  title: (f) => f.title,
  trainerName: (f) => f.trainerName,
  pathwayMode: (f) => (f.pathwayMode === 'linear' ? 'Linéaire' : 'Libre'),
  modulesCount: (f) => f.modulesCount,
  enrollmentsCount: (f) => f.enrollmentsCount,
  isPublished: (f) => (f.isPublished ? 'Publiée' : 'Brouillon'),
  createdAt: (f) => new Date(f.createdAt).getTime(),
};

interface Trainer {
  id: string;
  fullName: string;
  email: string;
}

export default function AdminFormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Formation | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { showToast } = useToast();

  // Bornes du slider Modules calculées dynamiquement depuis le dataset.
  const modulesMaxBound = useMemo(() => {
    if (formations.length === 0) return 10;
    return Math.max(1, ...formations.map((f) => f.modulesCount));
  }, [formations]);

  // Liste des formateurs présents dans les formations + option "Sans formateur".
  const trainerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    let hasNone = false;
    for (const f of formations) {
      if (f.trainerId && f.trainerName) seen.set(f.trainerId, f.trainerName);
      else hasNone = true;
    }
    const opts = Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (hasNone) opts.push({ value: NO_TRAINER_VALUE, label: 'Sans formateur' });
    return opts;
  }, [formations]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      type: 'multi',
      key: 'pathwayMode',
      label: 'Mode parcours',
      options: [
        { value: 'linear', label: 'Linéaire' },
        { value: 'free', label: 'Libre' },
      ],
    },
    {
      type: 'multi',
      key: 'published',
      label: 'Statut publication',
      options: [
        { value: 'true', label: 'Publiée' },
        { value: 'false', label: 'Brouillon' },
      ],
    },
    {
      type: 'multi',
      key: 'trainers',
      label: 'Formateur assigné',
      variant: 'dropdown',
      placeholder: 'Tous les formateurs',
      options: trainerOptions,
    },
    {
      type: 'numericRange',
      key: 'modules',
      label: 'Nombre de modules',
      min: 0,
      max: modulesMaxBound,
      step: 1,
    },
    {
      type: 'toggle',
      key: 'hasLearners',
      label: 'Avec apprenants inscrits',
      description: 'Uniquement les formations avec au moins 1 inscrit',
    },
  ], [trainerOptions, modulesMaxBound]);

  const t = useTableState({
    filterDefs,
    defaultSort: { field: 'createdAt', direction: 'desc' },
    pageSize: 50,
  });

  const filtered = useMemo(() => {
    const pathway = (t.filters.pathwayMode as string[]) ?? [];
    const published = (t.filters.published as string[]) ?? [];
    const trainers = (t.filters.trainers as string[]) ?? [];
    const modulesRange = (t.filters.modules as { min?: number; max?: number }) ?? {};
    const hasLearners = t.filters.hasLearners === true;

    return formations.filter((f) => {
      if (!matchesSearch(t.search, [f.title, f.description ?? ''])) return false;
      if (pathway.length > 0 && !pathway.includes(f.pathwayMode)) return false;
      if (published.length > 0 && !published.includes(String(f.isPublished))) return false;
      if (trainers.length > 0) {
        const id = f.trainerId ?? NO_TRAINER_VALUE;
        if (!trainers.includes(id)) return false;
      }
      if (modulesRange.min !== undefined && f.modulesCount < modulesRange.min) return false;
      if (modulesRange.max !== undefined && f.modulesCount > modulesRange.max) return false;
      if (hasLearners && f.enrollmentsCount === 0) return false;
      return true;
    });
  }, [formations, t.search, t.filters]);

  const sorted = useMemo(() => sortItems(filtered, t.sort, SORT_ACCESSORS), [filtered, t.sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / t.pageSize));
  const paginated = useMemo(
    () => sorted.slice(t.page * t.pageSize, (t.page + 1) * t.pageSize),
    [sorted, t.page, t.pageSize],
  );
  useEffect(() => {
    if (t.page > 0 && t.page >= totalPages) t.setPage(totalPages - 1);
  }, [t.page, totalPages, t.setPage]);

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<{ data: Formation[] }>('/admin/formations')
      .then((res) => setFormations(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer "${title}" et tout son contenu ?`)) return;
    try { await api.delete(`/admin/formations/${id}`); showToast('Formation supprimée', 'success'); loadData(); }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  async function handleDuplicate(id: string) {
    try { await api.post(`/admin/formations/${id}/duplicate`); showToast('Formation dupliquée', 'success'); loadData(); }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  async function handleTogglePublish(f: Formation) {
    try { await api.put(`/admin/formations/${f.id}`, { isPublished: !f.isPublished }); loadData(); }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  }

  if (loading && formations.length === 0) {
    return <div className="flex items-center gap-3 text-gray-500 py-12"><div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
        <button onClick={() => { setEditing(null); setShowCreate(true); }} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium">
          + Nouvelle formation
        </button>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {/* Slide-over for create/edit */}
      {(showCreate || editing) && (
        <FormationSlideOver
          initial={editing}
          onSave={() => { setShowCreate(false); setEditing(null); loadData(); showToast(editing ? 'Formation modifiée' : 'Formation créée', 'success'); }}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <SearchInput
          value={t.searchInput}
          onChange={t.setSearchInput}
          placeholder="Rechercher une formation..."
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            t.activeFilterCount > 0 || filtersOpen
              ? 'bg-brand-50 border-brand-300 text-brand-700'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
          aria-expanded={filtersOpen}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 9v6l-4 2v-8L3 4z" />
          </svg>
          Filtres{t.activeFilterCount > 0 ? ` (${t.activeFilterCount})` : ''}
        </button>
        <span className="ml-auto text-sm text-gray-500">
          {sorted.length} / {formations.length} formations
        </span>
      </div>

      {filtersOpen && (
        <div className="mb-4">
          <FilterPanel
            open={filtersOpen}
            filters={filterDefs}
            values={t.filters}
            onChange={t.setFilter}
            onReset={t.resetFilters}
            activeCount={t.activeFilterCount}
          />
        </div>
      )}

      {formations.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucune formation. Créez-en une pour commencer.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-3">Aucune formation ne correspond</p>
          <button
            onClick={t.resetSearchAndFilters}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Effacer les filtres
          </button>
        </div>
      ) : (
        <ResponsiveList<Formation>
          items={paginated}
          rowKey={(f) => f.id}
          titleKey={(f) => (
            <a href={`/admin/formations/${f.id}`} className="hover:text-brand-700 transition-colors">
              {f.title}
            </a>
          )}
          subtitleKey={(f) => (f.description ? <span className="line-clamp-2">{f.description}</span> : null)}
          badgeKey={(f) => (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
              f.isPublished ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {f.isPublished ? 'Publiée' : 'Brouillon'}
            </span>
          )}
          columns={[
            {
              key: 'title',
              mobileLabel: 'Formation',
              label: <SortableHeader field="title" label="Formation" currentSort={t.sort} onSortChange={t.cycleSort} />,
              mobileHidden: true,
              render: (f) => (
                <>
                  <p className="font-medium text-gray-900">{f.title}</p>
                  {f.description && <p className="text-xs text-gray-400 truncate max-w-xs">{f.description}</p>}
                </>
              ),
            },
            {
              key: 'trainer',
              mobileLabel: 'Formateur',
              label: <SortableHeader field="trainerName" label="Formateur" currentSort={t.sort} onSortChange={t.cycleSort} />,
              mobileHidden: true,
              render: (f) => <span className="text-xs text-gray-500">{f.trainerName || <span className="text-gray-300">—</span>}</span>,
            },
            {
              key: 'mode',
              mobileLabel: 'Mode',
              label: <SortableHeader field="pathwayMode" label="Mode" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (f) => (
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  f.pathwayMode === 'linear' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {f.pathwayMode === 'linear' ? 'Linéaire' : 'Libre'}
                </span>
              ),
            },
            {
              key: 'threshold', label: 'Seuil complétion',
              render: (f) => <span className="text-gray-700">{f.videoCompletionThreshold}%</span>,
            },
            {
              key: 'modules',
              mobileLabel: 'Modules',
              label: <SortableHeader field="modulesCount" label="Modules" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (f) => <span className="text-gray-700">{f.modulesCount}</span>,
            },
            {
              key: 'enrollments',
              mobileLabel: 'Inscrits',
              label: <SortableHeader field="enrollmentsCount" label="Inscrits" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (f) => <span className="text-gray-700">{f.enrollmentsCount ?? 0}</span>,
            },
            {
              key: 'published',
              mobileLabel: 'Publiée',
              label: <SortableHeader field="isPublished" label="Publiée" currentSort={t.sort} onSortChange={t.cycleSort} align="center" />,
              align: 'center',
              mobileHidden: true,
              render: (f) => <Toggle checked={f.isPublished} onChange={() => handleTogglePublish(f)} />,
            },
            {
              key: 'created',
              mobileLabel: 'Créée le',
              label: <SortableHeader field="createdAt" label="Créée le" currentSort={t.sort} onSortChange={t.cycleSort} />,
              mobileHidden: true,
              render: (f) => (
                <span className="text-gray-500 text-xs">
                  {new Date(f.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              ),
            },
            {
              key: 'actions', label: 'Actions', align: 'right', mobileHidden: true,
              render: (f) => (
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                  <a href={`/admin/formations/${f.id}`} className="px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded transition-colors font-medium">Gérer les modules</a>
                  <button onClick={() => setEditing(f)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Éditer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button onClick={() => handleDuplicate(f.id)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors">Dupliquer</button>
                  <button onClick={() => handleDelete(f.id, f.title)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors">Supprimer</button>
                </div>
              ),
            },
          ]}
          actions={(f) => (
            <>
              <a href={`/admin/formations/${f.id}`} className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 font-medium">Gérer les modules</a>
              <button onClick={() => setEditing(f)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Éditer</button>
              <button onClick={() => handleDuplicate(f.id)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Dupliquer</button>
              <button onClick={() => handleDelete(f.id, f.title)} className="text-xs text-red-500 hover:text-red-600 px-2 py-1">Supprimer</button>
            </>
          )}
        />
      )}

      {sorted.length > t.pageSize && (
        <Pagination page={t.page} totalPages={totalPages} onPageChange={t.setPage} />
      )}
    </div>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4.5 ml-[18px]' : 'translate-x-0.5 ml-[3px]'}`} />
    </button>
  );
}

// ─── Formation slide-over form ───────────────────────────────────────────────

function FormationSlideOver({ initial, onSave, onClose, onError }: {
  initial: Formation | null; onSave: () => void; onClose: () => void; onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [pathwayMode, setPathwayMode] = useState(initial?.pathwayMode ?? 'free');
  const [threshold, setThreshold] = useState(initial?.videoCompletionThreshold ?? 99);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [trainerId, setTrainerId] = useState<string | null>(initial?.trainerId ?? null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: Trainer[] }>('/admin/trainers')
      .then((res) => setTrainers(res.data))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!title.trim()) { onError('Le titre est requis'); return; }
    setSaving(true);
    try {
      const body = { title, description: description || undefined, pathwayMode, videoCompletionThreshold: threshold, isPublished, trainerId: trainerId || null };
      if (initial) { await api.put(`/admin/formations/${initial.id}`, body); }
      else { await api.post('/admin/formations', body); }
      onSave();
    } catch (err: unknown) { onError(err instanceof Error ? err.message : 'Erreur'); }
    setSaving(false);
  }

  const Wrapper = initial ? SlideOver : Modal;

  return (
    <Wrapper title={initial ? 'Modifier la formation' : 'Nouvelle formation'} onClose={onClose}
      footer={<div className="flex gap-3"><button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button><button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div>}>
      <div className="space-y-5">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y" /></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formateur assigné</label>
          <select value={trainerId ?? ''} onChange={(e) => setTrainerId(e.target.value || null)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">Aucun formateur</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.email})</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Mode de parcours</label><select value={pathwayMode} onChange={(e) => setPathwayMode(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="free">Libre (non linéaire)</option><option value="linear">Linéaire</option></select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Seuil de complétion vidéo (%)</label><input type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
        <div className="flex items-center gap-3"><Toggle checked={isPublished} onChange={() => setIsPublished(!isPublished)} /><span className="text-sm text-gray-700">{isPublished ? 'Publiée' : 'Brouillon'}</span></div>
      </div>
    </Wrapper>
  );
}
