'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Formation {
  id: string;
  title: string;
}

export default function AdminExportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [learnersFilters, setLearnersFilters] = useState({ formationId: '', from: '', to: '' });
  const [modulesFilters, setModulesFilters] = useState({ formationId: '' });
  const [logsFilters, setLogsFilters] = useState({ from: '', to: '' });

  useEffect(() => {
    api.get<{ data: { formations: Formation[] } }>('/admin/dashboard/sessions')
      .then((res) => setFormations(res.data.formations))
      .catch(() => { /* ignore */ });
  }, []);

  async function handleDownload(key: string, qs: string) {
    setDownloading(key);
    try {
      const res = await fetch(`/api/v1/admin/exports/${key}${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Récupère le nom de fichier du header si présent
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${key}_${Date.now()}.csv`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
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

  function buildQs(params: Record<string, string>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v);
    }
    const s = qs.toString();
    return s ? `?${s}` : '';
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Exports CSV</h1>
      <p className="text-sm text-gray-500 mb-6">Telechargez les donnees au format CSV</p>

      <div className="space-y-4">
        {/* Apprenants */}
        <ExportCard
          title="Apprenants par session"
          desc="Nom, email, statut, progression, temps, tentatives quiz, score moyen, derniere activite"
          downloading={downloading === 'apprenants'}
          onDownload={() => handleDownload('apprenants', buildQs(learnersFilters))}
        >
          <FiltersRow>
            <FormationSelect
              value={learnersFilters.formationId}
              formations={formations}
              onChange={(v) => setLearnersFilters({ ...learnersFilters, formationId: v })}
            />
            <DateInput
              label="Du"
              value={learnersFilters.from}
              onChange={(v) => setLearnersFilters({ ...learnersFilters, from: v })}
            />
            <DateInput
              label="Au"
              value={learnersFilters.to}
              onChange={(v) => setLearnersFilters({ ...learnersFilters, to: v })}
            />
          </FiltersRow>
        </ExportCard>

        {/* Modules */}
        <ExportCard
          title="Modules / UA"
          desc="Agregats par module et UA : nb apprenants, taux completion, temps moyen, score moyen"
          downloading={downloading === 'modules'}
          onDownload={() => handleDownload('modules', buildQs(modulesFilters))}
        >
          <FiltersRow>
            <FormationSelect
              value={modulesFilters.formationId}
              formations={formations}
              onChange={(v) => setModulesFilters({ formationId: v })}
            />
          </FiltersRow>
        </ExportCard>

        {/* Logs */}
        <ExportCard
          title="Logs evenements"
          desc="SSO, navigation, video, quiz, admin — filtrables par periode"
          downloading={downloading === 'logs'}
          onDownload={() => handleDownload('logs', buildQs(logsFilters))}
        >
          <FiltersRow>
            <DateInput
              label="Du"
              value={logsFilters.from}
              onChange={(v) => setLogsFilters({ ...logsFilters, from: v })}
            />
            <DateInput
              label="Au"
              value={logsFilters.to}
              onChange={(v) => setLogsFilters({ ...logsFilters, to: v })}
            />
          </FiltersRow>
        </ExportCard>

        {/* Relances */}
        <ExportCard
          title="Journal des relances"
          desc="Historique complet des emails de relance : regle, destinataire, statut"
          downloading={downloading === 'relances'}
          onDownload={() => handleDownload('relances', '')}
        />
      </div>
    </div>
  );
}

function ExportCard({
  title,
  desc,
  children,
  downloading,
  onDownload,
}: {
  title: string;
  desc: string;
  children?: React.ReactNode;
  downloading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
        <button
          onClick={onDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
          CSV
        </button>
      </div>
      {children}
    </div>
  );
}

function FiltersRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">{children}</div>;
}

function FormationSelect({
  value,
  formations,
  onChange,
}: {
  value: string;
  formations: Formation[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      Formation
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white min-w-[220px]"
      >
        <option value="">Toutes</option>
        {formations.map((f) => (
          <option key={f.id} value={f.id}>{f.title}</option>
        ))}
      </select>
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg bg-white"
      />
    </label>
  );
}
