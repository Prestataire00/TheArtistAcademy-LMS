'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/formatters';

interface ReminderLog {
  id: string;
  ruleName: string;
  formationId: string;
  formationTitle: string;
  recipientName: string;
  recipientEmail: string;
  templateId: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

interface Formation {
  id: string;
  title: string;
}

const statusStyles: Record<string, string> = {
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  skipped: 'bg-gray-100 text-gray-600',
};

export default function AdminRelancesPage() {
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formationFilter, setFormationFilter] = useState<string>('');

  useEffect(() => {
    api.get<{ data: { formations: Formation[] } }>('/admin/dashboard/sessions')
      .then((res) => setFormations(res.data.formations))
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (formationFilter) qs.set('formationId', formationFilter);
    const query = qs.toString() ? `?${qs.toString()}` : '';

    setLoading(true);
    api.get<{ data: ReminderLog[] }>(`/admin/relances${query}`)
      .then((res) => {
        setLogs(res.data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, formationFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Journal des relances</h1>
      <p className="text-sm text-gray-500 mb-6">Historique des emails de relance envoyes automatiquement</p>

      <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Statut
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white min-w-[160px]"
          >
            <option value="">Tous</option>
            <option value="sent">Envoye</option>
            <option value="failed">Echec</option>
            <option value="skipped">Ignore</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Formation
          <select
            value={formationFilter}
            onChange={(e) => setFormationFilter(e.target.value)}
            className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white min-w-[220px]"
          >
            <option value="">Toutes</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-12">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">{error}</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucune relance pour les filtres selectionnes</p>
          <p className="text-xs text-gray-400 mt-1">Les relances sont envoyees automatiquement chaque jour a 9h</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Formation</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Destinataire</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Regle</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Erreur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{l.formationTitle}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{l.recipientName}</p>
                      <p className="text-xs text-gray-400">{l.recipientEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.ruleName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(l.sentAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[l.status] || statusStyles.skipped}`}>
                        {l.status === 'sent' ? 'Envoye' : l.status === 'failed' ? 'Echec' : 'Ignore'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-500 hidden md:table-cell">{l.errorMessage || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
