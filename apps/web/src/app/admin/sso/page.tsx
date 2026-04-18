'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SsoLog {
  id: string;
  action: string;
  email: string;
  success: boolean;
  error: string | null;
  ipAddress: string | null;
  timestamp: string;
}

interface SsoStats {
  status: 'connected' | 'inactive' | 'unconfigured';
  lastWebhookAt: string | null;
  lastWebhookAction: string | null;
  lastLearnerActivityAt: string | null;
  last7Days: {
    ssoSuccess: number;
    ssoFailed: number;
    webhooks: number;
  };
}

const statusMeta: Record<SsoStats['status'], { label: string; cls: string; dot: string }> = {
  connected: { label: 'Connecte', cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  inactive: { label: 'Inactif', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  unconfigured: { label: 'Non configure', cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Aucune';
  return new Date(iso).toLocaleString('fr-FR');
}

export default function AdminSsoPage() {
  const [stats, setStats] = useState<SsoStats | null>(null);
  const [logs, setLogs] = useState<SsoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | 'success' | 'failed'>('');

  useEffect(() => {
    api.get<{ data: SsoStats }>('/admin/sso/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    setLoading(true);
    api.get<{ data: SsoLog[] }>(`/admin/sso/logs${qs}`)
      .then((res) => setLogs(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Diagnostic SSO Dendreo</h1>
      <p className="text-sm text-gray-500 mb-6">Etat de la connexion, logs recents et statistiques 7 jours</p>

      {/* Bloc 1 — Etat connexion */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <h2 className="font-medium text-gray-900 mb-4">Etat de la connexion Dendreo</h2>
        {!stats ? (
          <div className="h-16 flex items-center text-gray-400 text-sm">Chargement...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Statut global</p>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statusMeta[stats.status].cls}`}>
                <span className={`w-2 h-2 rounded-full ${statusMeta[stats.status].dot}`} />
                {statusMeta[stats.status].label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Derniere synchro Dendreo</p>
              <p className="text-sm font-medium text-gray-900">{formatDateTime(stats.lastWebhookAt)}</p>
              {stats.lastWebhookAction && (
                <p className="text-xs text-gray-400 mt-0.5">{stats.lastWebhookAction}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Derniere activite apprenant</p>
              <p className="text-sm font-medium text-gray-900">{formatDateTime(stats.lastLearnerActivityAt)}</p>
            </div>
          </div>
        )}
      </section>

      {/* Bloc 3 — Statistiques (placé avant les logs pour ergonomie) */}
      <section className="grid grid-cols-3 gap-4 mb-4">
        <StatCard label="Connexions SSO reussies (7j)" value={stats?.last7Days.ssoSuccess ?? null} accent="green" />
        <StatCard label="Echecs SSO (7j)" value={stats?.last7Days.ssoFailed ?? null} accent="red" />
        <StatCard label="Webhooks recus (7j)" value={stats?.last7Days.webhooks ?? null} accent="brand" />
      </section>

      {/* Bloc 2 — Logs SSO */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">Derniers logs SSO</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'success' | 'failed')}
            className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Tous</option>
            <option value="success">Succes</option>
            <option value="failed">Echec</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 p-8">
            <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            Chargement...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">Aucun evenement SSO pour ce filtre</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Resultat</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Erreur</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(l.timestamp)}</td>
                    <td className="px-4 py-3 text-gray-900">{l.email}</td>
                    <td className="px-4 py-3">
                      {l.success ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Succes</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">Echec</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-500 hidden md:table-cell">{l.error || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">{l.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | null; accent: 'green' | 'red' | 'brand' }) {
  const color = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-500' : 'text-brand-600';
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
    </div>
  );
}
