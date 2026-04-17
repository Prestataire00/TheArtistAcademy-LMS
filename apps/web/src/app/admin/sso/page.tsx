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

export default function AdminSsoPage() {
  const [logs, setLogs] = useState<SsoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: SsoLog[] }>('/admin/sso/logs')
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

  const successCount = logs.filter((l) => l.success).length;
  const failCount = logs.length - successCount;
  const lastSuccess = logs.find((l) => l.success);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Diagnostic SSO Dendreo</h1>
      <p className="text-sm text-gray-500 mb-6">Derniers 100 evenements SSO</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total connexions</p>
          <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Succes / Echecs</p>
          <p className="text-2xl font-bold">
            <span className="text-green-600">{successCount}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-red-500">{failCount}</span>
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Dernière connexion réussie</p>
          <p className="text-sm font-medium text-gray-900">
            {lastSuccess ? new Date(lastSuccess.timestamp).toLocaleString('fr-FR') : 'Aucune'}
          </p>
        </div>
      </div>

      {/* Logs table */}
      {logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucun evenement SSO enregistre</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString('fr-FR')}
                    </td>
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
        </div>
      )}
    </div>
  );
}
