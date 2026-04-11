'use client';

import { useState } from 'react';

const exports = [
  { key: 'learners', label: 'Apprenants par session', desc: 'Nom, email, progression, temps, statut' },
  { key: 'modules', label: 'Modules / UA', desc: 'Structure des formations, types, positions' },
  { key: 'logs', label: 'Logs evenements', desc: 'SSO, navigation, video, quiz, admin' },
  { key: 'reminders', label: 'Journal relances', desc: 'Regles, destinataires, statuts envoi' },
];

export default function AdminExportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(key: string) {
    setDownloading(key);
    try {
      const res = await fetch(`/api/v1/admin/exports/${key}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${key}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur de telechargement');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Exports CSV</h1>
      <p className="text-sm text-gray-500 mb-6">Telechargez les donnees au format CSV</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {exports.map((ex) => (
          <div key={ex.key} className="bg-white rounded-lg border border-gray-200 p-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">{ex.label}</h3>
              <p className="text-xs text-gray-500">{ex.desc}</p>
            </div>
            <button
              onClick={() => handleDownload(ex.key)}
              disabled={downloading === ex.key}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {downloading === ex.key ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
              CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
