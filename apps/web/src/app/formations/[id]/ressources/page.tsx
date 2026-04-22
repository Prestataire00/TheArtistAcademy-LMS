'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Resource {
  id: string;
  uaId: string;
  uaTitle: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number | null;
}

interface ModuleResources {
  moduleId: string;
  moduleTitle: string;
  position: number;
  resources: Resource[];
}

interface ResourcesData {
  byModule: ModuleResources[];
  all: Resource[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return (
      <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-red-600">PDF</span>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-orange-600">PPT</span>
    </div>
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RessourcesPage() {
  const params = useParams<{ id: string }>();
  const formationId = params.id;

  const [data, setData] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!formationId) return;
    api.get<{ data: ResourcesData }>(`/player/formations/${formationId}/resources`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [formationId]);

  async function handleDownload(resource: Resource) {
    setDownloading(resource.id);
    try {
      const res = await api.get<{ data: { signedUrl: string; fileName: string } }>(`/player/resources/${resource.id}/download`);
      const a = document.createElement('a');
      a.href = res.data.signedUrl;
      a.download = res.data.fileName || resource.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur de telechargement');
    } finally {
      setDownloading(null);
    }
  }

  // ─── Loading / Error ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement des ressources...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Impossible de charger les ressources</h1>
          <p className="text-gray-500 mb-6">{error || 'Erreur inconnue'}</p>
          <a href={`/formations/${formationId}`} className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
            Retour à la formation
          </a>
        </div>
      </div>
    );
  }

  const isEmpty = data.all.length === 0;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
          <a
            href={`/formations/${formationId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors flex-shrink-0 py-2 -my-2 min-h-[44px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">Retour à la formation</span>
            <span className="sm:hidden">Retour</span>
          </a>
          <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
          <h1 className="text-base font-semibold text-gray-900 truncate">Ressources</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isEmpty ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-gray-500">Aucune ressource disponible pour cette formation.</p>
          </div>
        ) : (
          <>
            {/* Toggle view */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-500">{data.all.length} ressource{data.all.length > 1 ? 's' : ''}</p>
              <button
                onClick={() => setViewAll(!viewAll)}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors py-2 -my-2 min-h-[44px]"
              >
                {viewAll ? 'Grouper par module' : 'Tout voir'}
              </button>
            </div>

            {viewAll ? (
              /* ─── Vue a plat ─────────────────────────────────────────── */
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                {data.all.map((r) => (
                  <ResourceRow key={r.id} resource={r} downloading={downloading} onDownload={handleDownload} />
                ))}
              </div>
            ) : (
              /* ─── Vue par module ─────────────────────────────────────── */
              <div className="space-y-6">
                {data.byModule.map((mod) => (
                  <div key={mod.moduleId}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{mod.moduleTitle}</h3>
                    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {mod.resources.map((r) => (
                        <ResourceRow key={r.id} resource={r} downloading={downloading} onDownload={handleDownload} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Resource row ────────────────────────────────────────────────────────────

function ResourceRow({
  resource,
  downloading,
  onDownload,
}: {
  resource: Resource;
  downloading: string | null;
  onDownload: (r: Resource) => void;
}) {
  const isDownloading = downloading === resource.id;

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
      {fileIcon(resource.fileType)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{resource.fileName}</p>
        <p className="text-xs text-gray-400 truncate">
          {resource.uaTitle}
          {resource.fileSizeBytes ? ` — ${formatSize(resource.fileSizeBytes)}` : ''}
        </p>
      </div>
      <button
          onClick={() => onDownload(resource)}
          disabled={isDownloading}
          aria-label="Télécharger"
          className="flex items-center justify-center gap-1.5 px-3 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 min-w-[44px] min-h-[44px]"
        >
          {isDownloading ? (
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
          <span className="hidden sm:inline">Télécharger</span>
        </button>
    </div>
  );
}
