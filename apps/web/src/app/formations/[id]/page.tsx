'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDuration, formatDate, formatStatus } from '@/lib/formatters';
import { ProgressBar } from '@/components/progress/ProgressBar';
import type { CompletionStatus, UAType } from '@/types';

// ─── Types API response ──────────────────────────────────────────────────────

interface FormationPageData {
  formation: {
    id: string;
    title: string;
    description: string | null;
    pathwayMode: 'linear' | 'free';
    trainerName?: string | null;
  };
  enrollment: {
    id: string;
    startDate: string;
    endDate: string;
  };
  progress: {
    status: CompletionStatus;
    progressPercent: number;
    timeSpentSeconds: number;
    completedUAs: number;
    totalUAs: number;
  };
  continueUaId: string | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    position: number;
    status: CompletionStatus;
    progressPercent: number;
    isLocked: boolean;
    uas: Array<{
      id: string;
      title: string;
      type: UAType;
      position: number;
      status: CompletionStatus;
    }>;
  }>;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function UAIcon({ type, status }: { type: UAType; status: CompletionStatus }) {
  const completed = status === 'completed';
  const base = 'w-5 h-5 flex-shrink-0';

  if (completed) {
    return (
      <svg className={`${base} text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (type === 'video') {
    return (
      <svg className={`${base} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
      </svg>
    );
  }

  if (type === 'quiz') {
    return (
      <svg className={`${base} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    );
  }

  // resource
  return (
    <svg className={`${base} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function StatusBadge({ status }: { status: CompletionStatus }) {
  const styles = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-brand-50 text-brand-700',
    completed: 'bg-green-50 text-green-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {formatStatus(status)}
    </span>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function FormationPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<FormationPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    api.get<{ data: FormationPageData }>(`/player/formations/${params.id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement de la formation...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Impossible de charger la formation</h1>
          <p className="text-gray-500 mb-6">{error || 'Erreur inconnue'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Remonter
          </button>
        </div>
      </div>
    );
  }

  const { formation, enrollment, progress, modules, continueUaId } = data;
  const isCompleted = progress.status === 'completed';

  return (
    <div className="min-h-screen bg-light">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* Top bar avec logo + lien Dendreo */}
          <div className="flex items-center justify-between mb-3">
            <img src="/logo-dark.png" alt="The Artist Academy" className="h-10 sm:h-12 w-auto" />
            <a
              href={process.env.NEXT_PUBLIC_DENDREO_EXTRANET_URL || '#'}
              className="text-sm text-dark-muted hover:text-brand-600 transition-colors"
            >
              Mes formations
            </a>
          </div>

          {/* Titre + CTA sur la meme ligne */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 mb-0.5">{formation.title}</h1>
              {formation.trainerName && (
                <p className="text-sm text-gray-500">Par {formation.trainerName}</p>
              )}
            </div>

            {/* Bouton CTA */}
            {isCompleted ? (
              <a
                href={continueUaId ? `/uas/${modules[0]?.uas[0]?.id}` : '#'}
                className="inline-flex items-center gap-2 px-5 py-2 bg-dark text-white rounded-lg hover:bg-dark-light transition-colors font-medium text-sm flex-shrink-0"
              >
                Revoir le contenu
              </a>
            ) : continueUaId ? (
              <a
                href={`/uas/${continueUaId}`}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm flex-shrink-0"
              >
                {progress.status === 'not_started' ? 'Commencer' : 'Continuer'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            ) : null}
          </div>

          {formation.description && (
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">{formation.description}</p>
          )}

          {/* Bandeau formation terminee */}
          {isCompleted && (
            <div className="mb-3 flex items-center gap-2 bg-green-50 text-green-800 rounded-lg px-3 py-2 border border-green-200 text-sm">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Formation terminee — vous pouvez revoir le contenu tant que votre acces est ouvert.
            </div>
          )}

          {/* Progression globale */}
          <div className="mb-3">
            <ProgressBar percent={progress.progressPercent} label="Progression globale" />
          </div>

          {/* Meta infos — texte simple, sans icones */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mb-3">
            <span>Du {formatDate(enrollment.startDate)} au {formatDate(enrollment.endDate)}</span>
            <span>Temps : {formatDuration(progress.timeSpentSeconds)}</span>
            <span>{progress.completedUAs}/{progress.totalUAs} activites</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200 -mx-6 px-6">
            <span className="pb-2 border-b-2 border-brand-600 text-sm font-medium text-brand-700">
              Modules
            </span>
            <a
              href={`/formations/${formation.id}/ressources`}
              className="pb-2 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Ressources
            </a>
          </div>
        </div>
      </header>

      {/* ─── Modules ─────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-6 py-5">
        <div className="space-y-2">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Module card ─────────────────────────────────────────────────────────────

interface ModuleCardProps {
  module: FormationPageData['modules'][number];
}

function ModuleCard({ module: mod }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(mod.status === 'in_progress' || mod.position === 0);

  return (
    <div
      className={`bg-white rounded-lg border transition-colors ${
        mod.isLocked ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Module header */}
      <button
        onClick={() => !mod.isLocked && setExpanded(!expanded)}
        disabled={mod.isLocked}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-sm text-gray-900 truncate" title={mod.title}>{mod.title}</h3>
            {mod.isLocked && <LockIcon />}
            <StatusBadge status={mod.status} />
          </div>
          <ProgressBar percent={mod.progressPercent} size="sm" />
        </div>

        {/* Chevron */}
        {!mod.isLocked && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </button>

      {/* UA list */}
      {expanded && !mod.isLocked && (
        <div className="border-t border-gray-100 px-4 py-2">
          <ul className="space-y-0.5">
            {mod.uas.map((ua) => (
              <li key={ua.id}>
                <a
                  href={`/uas/${ua.id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors group"
                >
                  <UAIcon type={ua.type} status={ua.status} />
                  <span
                    className={`flex-1 text-sm truncate ${
                      ua.status === 'completed' ? 'text-gray-500' : 'text-gray-900'
                    } group-hover:text-brand-700 transition-colors`}
                    title={ua.title}
                  >
                    {ua.title}
                  </span>
                  <span className="text-xs text-gray-400 capitalize flex-shrink-0">{ua.type}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
