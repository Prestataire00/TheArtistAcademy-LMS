'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { ResponsiveList } from '@/components/ResponsiveList';
import { SortableHeader } from '@/components/SortableHeader';
import { useTableState, sortItems } from '@/lib/useTableState';

interface SessionStat {
  formationId: string;
  title: string;
  learnersCount: number;
  completedCount: number;
  completionRate: number;
  avgProgress: number;
  avgTimeSpentSeconds: number;
  avgQuizScore: number | null;
}

interface DashboardData {
  formationsCount: number;
  activeLearnersCount: number;
  globalCompletionRate: number;
  sessions: SessionStat[];
}

const SORT_ACCESSORS: Record<string, (s: SessionStat) => unknown> = {
  title: (s) => s.title,
  learnersCount: (s) => s.learnersCount,
  completionRate: (s) => s.completionRate,
  avgProgress: (s) => s.avgProgress,
  avgTimeSpentSeconds: (s) => s.avgTimeSpentSeconds,
  avgQuizScore: (s) => s.avgQuizScore,
};

function formatDuration(seconds: number): string {
  if (!seconds) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = useTableState({ filterDefs: [], pageSize: 200 });

  useEffect(() => {
    api.get<{ data: DashboardData }>('/admin/dashboard/stats')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedSessions = useMemo(
    () => (data ? sortItems(data.sessions, t.sort, SORT_ACCESSORS) : []),
    [data, t.sort],
  );

  if (loading) return <Loader />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard label="Formations" value={String(data.formationsCount)} />
        <KpiCard label="Apprenants actifs" value={String(data.activeLearnersCount)} />
        <KpiCard label="Taux completion global" value={`${data.globalCompletionRate}%`} />
      </div>

      {/* Sessions table */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Par formation</h2>
      {data.sessions.length === 0 ? (
        <Empty msg="Aucune formation avec des apprenants" />
      ) : (
        <ResponsiveList<SessionStat>
          items={sortedSessions}
          rowKey={(s) => s.formationId}
          titleKey={(s) => s.title}
          badgeKey={(s) => (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
              {s.completionRate}%
            </span>
          )}
          columns={[
            {
              key: 'title',
              mobileLabel: 'Formation',
              label: <SortableHeader field="title" label="Formation" currentSort={t.sort} onSortChange={t.cycleSort} />,
              mobileHidden: true,
              render: (s) => <span className="font-medium text-gray-900">{s.title}</span>,
            },
            {
              key: 'learners',
              mobileLabel: 'Apprenants',
              label: <SortableHeader field="learnersCount" label="Apprenants" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (s) => <span className="text-gray-700">{s.learnersCount}</span>,
            },
            {
              key: 'completion',
              mobileLabel: 'Complétion',
              label: <SortableHeader field="completionRate" label="Complétion" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (s) => (
                <span className="text-gray-700 text-xs">{s.completedCount}/{s.learnersCount} ({s.completionRate}%)</span>
              ),
            },
            {
              key: 'progress',
              mobileLabel: 'Progression moy.',
              label: <SortableHeader field="avgProgress" label="Progression moy." currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (s) => (
                <div className="flex items-center gap-2">
                  <div className="w-24 md:w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-1.5 bg-brand-600 rounded-full" style={{ width: `${s.avgProgress}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{s.avgProgress}%</span>
                </div>
              ),
            },
            {
              key: 'time',
              mobileLabel: 'Temps moyen',
              label: <SortableHeader field="avgTimeSpentSeconds" label="Temps moyen" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (s) => <span className="text-xs text-gray-700">{formatDuration(s.avgTimeSpentSeconds)}</span>,
            },
            {
              key: 'quiz',
              mobileLabel: 'Score moy. QCM/VF',
              label: <SortableHeader field="avgQuizScore" label="Score moy. QCM/VF" currentSort={t.sort} onSortChange={t.cycleSort} />,
              render: (s) => (
                <span className="text-xs text-gray-700">
                  {s.avgQuizScore !== null ? `${s.avgQuizScore}%` : <span className="text-gray-300">—</span>}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center gap-3 text-gray-500 py-12">
      <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      Chargement...
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-red-600 font-medium mb-2">Erreur</p>
      <p className="text-gray-500 text-sm">{msg}</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <p className="text-gray-400">{msg}</p>
    </div>
  );
}
