'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Apprenant {
  userId: string;
  fullName: string;
  email: string;
  enrollmentId: string;
  status: string;
  progressPercent: number;
  timeSpentSeconds: number;
  completedUAs: number;
  totalUAs: number;
  lastActivity: string | null;
  lastSeenAt: string | null;
}

interface ApprenantsData {
  formationTitle: string;
  formationId: string;
  apprenants: Apprenant[];
}

interface Stats {
  formationTitle: string;
  learnersCount: number;
  completionRate: number;
  completedCount: number;
  avgProgressPercent: number;
  avgTimeSpentSeconds: number;
  avgScorePercent: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'Jamais';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days}j`;
}

function isInactive(lastActivity: string | null): boolean {
  if (!lastActivity) return true;
  return Date.now() - new Date(lastActivity).getTime() > 7 * 86400000;
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const formationId = params.id;

  const [data, setData] = useState<ApprenantsData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'late'>('all');

  useEffect(() => {
    if (!formationId) return;
    Promise.all([
      api.get<{ data: ApprenantsData }>(`/formateur/sessions/${formationId}/apprenants`),
      api.get<{ data: Stats }>(`/formateur/sessions/${formationId}/stats`),
    ])
      .then(([appRes, statsRes]) => {
        setData(appRes.data);
        setStats(statsRes.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [formationId]);

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
          <a href="/formateur/sessions" className="text-brand-600 hover:text-brand-700 text-sm font-medium">
            Retour aux sessions
          </a>
        </div>
      </div>
    );
  }

  const filtered = filter === 'late'
    ? data.apprenants.filter((a) => a.status !== 'completed' && isInactive(a.lastActivity))
    : data.apprenants;

  const lateCount = data.apprenants.filter((a) => a.status !== 'completed' && isInactive(a.lastActivity)).length;

  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <a href="/formateur/sessions" className="text-sm text-gray-500 hover:text-brand-700 transition-colors mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Mes sessions
          </a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{data.formationTitle}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard label="Taux completion" value={`${stats.completionRate}%`} sub={`${stats.completedCount}/${stats.learnersCount}`} />
            <StatCard label="Progression moy." value={`${stats.avgProgressPercent}%`} />
            <StatCard label="Temps moyen" value={formatDuration(stats.avgTimeSpentSeconds)} />
            <StatCard label="Score moyen" value={stats.avgScorePercent !== null ? `${stats.avgScorePercent}%` : '—'} />
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              filter === 'all' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tous ({data.apprenants.length})
          </button>
          <button
            onClick={() => setFilter('late')}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              filter === 'late' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            En retard / Inactifs ({lateCount})
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Apprenant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Progression</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Temps</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Dernière activité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      {filter === 'late' ? 'Aucun apprenant en retard' : 'Aucun apprenant inscrit'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={a.enrollmentId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={`/formateur/sessions/${formationId}/apprenants/${a.userId}`}
                          className="hover:text-brand-700 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{a.fullName}</p>
                          <p className="text-xs text-gray-400">{a.email}</p>
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[a.status] || statusStyles.not_started}`}>
                          {statusLabels[a.status] || a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-brand-600 rounded-full" style={{ width: `${a.progressPercent}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{a.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {formatDuration(a.timeSpentSeconds)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={isInactive(a.lastActivity) && a.status !== 'completed' ? 'text-red-500 font-medium' : 'text-gray-500'}>
                          {timeAgo(a.lastActivity)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
