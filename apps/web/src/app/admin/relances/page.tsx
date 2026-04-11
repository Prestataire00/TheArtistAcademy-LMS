'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/formatters';

interface ReminderLog {
  id: string;
  ruleName: string;
  recipientName: string;
  recipientEmail: string;
  templateId: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

const statusStyles: Record<string, string> = {
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  skipped: 'bg-gray-100 text-gray-600',
};

export default function AdminRelancesPage() {
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: ReminderLog[] }>('/admin/relances')
      .then((res) => setLogs(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-500 py-12">
        <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        Chargement...
      </div>
    );
  }

  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Journal des relances</h1>
      <p className="text-sm text-gray-500 mb-6">Historique des emails de relance envoyes automatiquement</p>

      {logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucune relance envoyee pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">Les relances seront envoyees automatiquement selon les regles configurees</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Regle</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Destinataire</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Erreur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{l.ruleName}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{l.recipientName}</p>
                      <p className="text-xs text-gray-400">{l.recipientEmail}</p>
                    </td>
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
