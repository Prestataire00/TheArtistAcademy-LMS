'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SessionStat {
  formationId: string;
  title: string;
  learnersCount: number;
  completedCount: number;
  completionRate: number;
  avgProgress: number;
}

interface DashboardData {
  formationsCount: number;
  activeLearnersCount: number;
  globalCompletionRate: number;
  sessions: SessionStat[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: DashboardData }>('/admin/dashboard/stats')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Formation</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Apprenants</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Progression moy.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.sessions.map((s) => (
                <tr key={s.formationId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.title}</td>
                  <td className="px-4 py-3 text-gray-600">{s.learnersCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-brand-600 rounded-full" style={{ width: `${s.avgProgress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{s.avgProgress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.completedCount}/{s.learnersCount} ({s.completionRate}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
