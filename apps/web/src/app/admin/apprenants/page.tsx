'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ResponsiveList } from '@/components/ResponsiveList';

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
  not_started: 'Non demarre',
  in_progress: 'En cours',
  completed: 'Termine',
};
const statusStyles: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-brand-50 text-brand-700',
  completed: 'bg-green-50 text-green-700',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Jamais';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days}j`;
}

export default function AdminApprenantsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const q = filter ? `?formationId=${filter}` : '';
    setLoading(true);
    api.get<{ data: Data }>(`/admin/dashboard/sessions${q}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Apprenants</h1>
        {data && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Toutes les formations</option>
            {data.formations.map((f) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      ) : !data || data.apprenants.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucun apprenant inscrit</p>
        </div>
      ) : (
        <ResponsiveList<Apprenant>
          items={data.apprenants}
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
              key: 'name', label: 'Apprenant', mobileHidden: true,
              render: (a) => (
                <>
                  <p className="font-medium text-gray-900">{a.fullName}</p>
                  <p className="text-xs text-gray-400">{a.email}</p>
                </>
              ),
            },
            {
              key: 'formation', label: 'Formation',
              render: (a) => <span className="text-xs text-gray-600 break-words">{a.formationTitle}</span>,
            },
            {
              key: 'status', label: 'Statut', mobileHidden: true,
              render: (a) => (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[a.status] || statusStyles.not_started}`}>
                  {statusLabels[a.status] || a.status}
                </span>
              ),
            },
            {
              key: 'progress', label: 'Progression',
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
              key: 'activity', label: 'Dernière activité',
              render: (a) => <span className="text-xs text-gray-500">{timeAgo(a.lastActivity)}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}
