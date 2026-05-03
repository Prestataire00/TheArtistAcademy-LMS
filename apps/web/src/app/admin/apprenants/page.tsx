'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { ResponsiveList } from '@/components/ResponsiveList';
import { SearchInput } from '@/components/SearchInput';
import { SortableHeader } from '@/components/SortableHeader';
import { FilterPanel } from '@/components/FilterPanel';
import { Pagination } from '@/components/Pagination';
import { matchesSearch } from '@/lib/search';
import { useTableState, sortItems, type FilterDef } from '@/lib/useTableState';

interface Apprenant {
  userId: string;
  fullName: string;
  email: string;
  formationId: string;
  formationTitle: string;
  status: string;
  progressPercent: number;
  lastActivity: string | null;
}

interface Formation {
  id: string;
  title: string;
}

interface Data {
  formations: Formation[];
  apprenants: Apprenant[];
}

const statusLabels: Record<string, string> = {
  not_started: 'Non démarrée',
  in_progress: 'En cours',
  completed: 'Terminée',
};
const statusStyles: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-brand-50 text-brand-700',
  completed: 'bg-green-50 text-green-700',
};

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Non démarrée' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
];

const ACTIVITY_OPTIONS = [
  { value: 'under_7d', label: '< 7 jours' },
  { value: 'under_30d', label: '< 30 jours' },
  { value: 'over_30d', label: 'Inactif > 30 jours' },
  { value: 'never', label: 'Jamais connecté' },
];

const SORT_ACCESSORS: Record<string, (a: Apprenant) => unknown> = {
  fullName: (a) => a.fullName,
  email: (a) => a.email,
  formationTitle: (a) => a.formationTitle,
  progressPercent: (a) => a.progressPercent,
  lastActivity: (a) => (a.lastActivity ? new Date(a.lastActivity).getTime() : null),
  status: (a) => a.status,
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Jamais';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days}j`;
}

function matchesActivityWindow(iso: string | null, window: string): boolean {
  if (window === 'never') return iso === null;
  if (iso === null) return false;
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (window === 'under_7d') return days < 7;
  if (window === 'under_30d') return days < 30;
  if (window === 'over_30d') return days >= 30;
  return true;
}

export default function AdminApprenantsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      type: 'multi',
      key: 'formation',
      label: 'Formation',
      variant: 'dropdown',
      placeholder: 'Toutes les formations',
      options: (data?.formations ?? []).map((f) => ({ value: f.id, label: f.title })),
    },
    { type: 'multi', key: 'status', label: 'Statut', options: STATUS_OPTIONS },
    {
      type: 'numericRange',
      key: 'progress',
      label: 'Progression',
      min: 0,
      max: 100,
      step: 5,
      suffix: '%',
    },
    { type: 'singleSelect', key: 'lastActivity', label: 'Dernière activité', options: ACTIVITY_OPTIONS },
  ], [data]);

  const t = useTableState({ filterDefs, pageSize: 50 });

  useEffect(() => {
    setLoading(true);
    api.get<{ data: Data }>('/admin/dashboard/sessions')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const formationFilter = (t.filters.formation as string[]) ?? [];
    const statusFilter = (t.filters.status as string[]) ?? [];
    const progress = (t.filters.progress as { min?: number; max?: number }) ?? {};
    const activity = t.filters.lastActivity as string | undefined;

    return data.apprenants.filter((a) => {
      if (!matchesSearch(t.search, [a.fullName, a.email])) return false;
      if (formationFilter.length > 0 && !formationFilter.includes(a.formationId)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(a.status)) return false;
      if (progress.min !== undefined && a.progressPercent < progress.min) return false;
      if (progress.max !== undefined && a.progressPercent > progress.max) return false;
      if (activity && !matchesActivityWindow(a.lastActivity, activity)) return false;
      return true;
    });
  }, [data, t.search, t.filters]);

  const sorted = useMemo(() => sortItems(filtered, t.sort, SORT_ACCESSORS), [filtered, t.sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / t.pageSize));
  const paginated = useMemo(
    () => sorted.slice(t.page * t.pageSize, (t.page + 1) * t.pageSize),
    [sorted, t.page, t.pageSize],
  );
  useEffect(() => {
    if (t.page > 0 && t.page >= totalPages) t.setPage(totalPages - 1);
  }, [t.page, totalPages, t.setPage]);

  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;

  const totalCount = data?.apprenants.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Apprenants</h1>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <SearchInput
          value={t.searchInput}
          onChange={t.setSearchInput}
          placeholder="Rechercher par nom ou email..."
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
          {sorted.length} / {totalCount} apprenants
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

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      ) : !data || data.apprenants.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucun apprenant inscrit</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-3">Aucun résultat</p>
          <button
            onClick={t.resetSearchAndFilters}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Effacer les filtres
          </button>
        </div>
      ) : (
        <>
          <ResponsiveList<Apprenant>
            items={paginated}
            rowKey={(a, i) => `${a.userId}-${a.formationId}-${i}`}
            titleKey={(a) => a.fullName}
            subtitleKey={(a) => <span className="truncate block">{a.email}</span>}
            badgeKey={(a) => (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                statusStyles[a.status] || statusStyles.not_started
              }`}>
                {statusLabels[a.status] || a.status}
              </span>
            )}
            columns={[
              {
                key: 'name',
                mobileLabel: 'Apprenant',
                label: <SortableHeader field="fullName" label="Apprenant" currentSort={t.sort} onSortChange={t.cycleSort} />,
                mobileHidden: true,
                render: (a) => (
                  <>
                    <p className="font-medium text-gray-900">{a.fullName}</p>
                    <p className="text-xs text-gray-400">{a.email}</p>
                  </>
                ),
              },
              {
                key: 'formation',
                mobileLabel: 'Formation',
                label: <SortableHeader field="formationTitle" label="Formation" currentSort={t.sort} onSortChange={t.cycleSort} />,
                render: (a) => <span className="text-xs text-gray-600 break-words">{a.formationTitle}</span>,
              },
              {
                key: 'status',
                mobileLabel: 'Statut',
                label: <SortableHeader field="status" label="Statut" currentSort={t.sort} onSortChange={t.cycleSort} />,
                mobileHidden: true,
                render: (a) => (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[a.status] || statusStyles.not_started}`}>
                    {statusLabels[a.status] || a.status}
                  </span>
                ),
              },
              {
                key: 'progress',
                mobileLabel: 'Progression',
                label: <SortableHeader field="progressPercent" label="Progression" currentSort={t.sort} onSortChange={t.cycleSort} />,
                render: (a) => (
                  <div className="flex items-center gap-2">
                    <div className="w-24 md:w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-brand-600 rounded-full" style={{ width: `${a.progressPercent}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{a.progressPercent}%</span>
                  </div>
                ),
              },
              {
                key: 'activity',
                mobileLabel: 'Dernière activité',
                label: <SortableHeader field="lastActivity" label="Dernière activité" currentSort={t.sort} onSortChange={t.cycleSort} />,
                render: (a) => <span className="text-xs text-gray-500">{timeAgo(a.lastActivity)}</span>,
              },
            ]}
          />

          {sorted.length > t.pageSize && (
            <Pagination page={t.page} totalPages={totalPages} onPageChange={t.setPage} />
          )}
        </>
      )}
    </div>
  );
}
