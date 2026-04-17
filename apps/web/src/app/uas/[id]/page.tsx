'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { VideoPlayer } from '@/components/VideoPlayer';

interface UAData {
  id: string;
  title: string;
  type: 'video' | 'quiz' | 'resource';
  formationId: string;
  formationTitle: string;
  durationSeconds: number | null;
  resourceId: string | null;
  resourceFileName: string | null;
}

export default function UAPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ua, setUA] = useState<UAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    api.get<{ data: UAData }>(`/player/uas/${params.id}`)
      .then((res) => setUA(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  if (error || !ua) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {error?.includes('inscription') ? 'Acces refuse' : 'Erreur'}
          </h1>
          <p className="text-gray-500 mb-6">{error || 'Contenu introuvable'}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Retour
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <a
            href={`/formations/${ua.formationId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">{ua.formationTitle}</span>
            <span className="sm:hidden">Retour</span>
          </a>

          <div className="h-4 w-px bg-gray-200 flex-shrink-0" />

          <h1 className="text-base font-semibold text-gray-900 truncate">{ua.title}</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {ua.type === 'video' && (
          <VideoPlayer uaId={ua.id} />
        )}

        {ua.type === 'quiz' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600 mb-4">Ce contenu est un quiz.</p>
            <a
              href={`/uas/${ua.id}/quiz`}
              className="inline-block px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
            >
              Commencer le quiz
            </a>
          </div>
        )}

        {ua.type === 'resource' && (
          <ResourceAutoDownload uaId={ua.id} formationId={ua.formationId} />
        )}
      </main>
    </div>
  );
}

// ─── Resource auto-download ──────────────────────────────────────────────────

function ResourceAutoDownload({ uaId, formationId }: { uaId: string; formationId: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    async function loadUrl() {
      try {
        const uaRes = await api.get<{ data: { resourceId: string | null; resourceFileName: string | null } }>(`/player/uas/${uaId}`);
        const resourceId = uaRes.data.resourceId;
        if (!resourceId) { setStatus('error'); return; }
        setFileName(uaRes.data.resourceFileName || 'fichier');

        const dlRes = await api.get<{ data: { signedUrl: string } }>(`/player/resources/${resourceId}/download`);
        setSignedUrl(dlRes.data.signedUrl);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }
    loadUrl();
  }, [uaId]);

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Chargement de la ressource...
        </div>
      </div>
    );
  }

  if (status === 'error' || !signedUrl) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 mb-4">Impossible de charger la ressource</p>
        <a href={`/formations/${formationId}`} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
          Retour a la formation
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <p className="text-sm font-medium text-gray-900 mb-1">{fileName}</p>
      <p className="text-xs text-gray-400 mb-6">Cliquez pour telecharger la ressource</p>
      <div className="flex items-center justify-center gap-3">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Telecharger
        </a>
        <a
          href={`/formations/${formationId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
        >
          Retour a la formation
        </a>
      </div>
    </div>
  );
}
