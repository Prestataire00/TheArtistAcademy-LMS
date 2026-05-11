'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ResourceViewer } from '@/components/ResourceViewer';

interface UAData {
  id: string;
  title: string;
  type: 'video' | 'quiz' | 'resource';
  formationId: string;
  formationTitle: string;
  durationSeconds: number | null;
  resourceId: string | null;
  resourceFileName: string | null;
  resourceFileType: string | null;
}

export default function UAPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ua, setUA] = useState<UAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    api.get<{ data: UAData }>(`/player/uas/${params.id}`)
      .then((res) => setUA(res.data))
      .catch((err: Error & { code?: string; status?: number }) => {
        setError(err.message);
        setErrorCode(err.code ?? null);
      })
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

  if (errorCode === 'UA_LOCKED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Cette unité n&apos;est pas encore accessible</h1>
          <p className="text-gray-500 mb-6">Termine l&apos;unité précédente pour débloquer celle-ci.</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Retour à la formation
          </button>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
          <a
            href={`/formations/${ua.formationId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors flex-shrink-0 py-2 -my-2 min-h-[44px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">{ua.formationTitle}</span>
            <span className="sm:hidden">Retour</span>
          </a>

          <div className="h-4 w-px bg-gray-200 flex-shrink-0" />

          <h1 className="text-base font-semibold text-gray-900 truncate">{ua.title}</h1>
        </div>
      </header>

      {/* Content — video occupe toute la largeur sur mobile, avec padding a partir de sm */}
      <main className={`${ua.type === 'video' ? 'max-w-4xl mx-auto sm:px-6 sm:py-6' : 'max-w-4xl mx-auto px-4 sm:px-6 py-6'}`}>
        {ua.type === 'video' && (
          <VideoPlayer uaId={ua.id} />
        )}

        {ua.type === 'quiz' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 text-center">
            <p className="text-gray-600 mb-4">Ce contenu est un quiz.</p>
            <a
              href={`/uas/${ua.id}/quiz`}
              className="inline-flex items-center justify-center px-5 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium min-h-[44px]"
            >
              Commencer le quiz
            </a>
          </div>
        )}

        {ua.type === 'resource' && ua.resourceId && (
          <ResourceInlinePanel
            resourceId={ua.resourceId}
            fileType={ua.resourceFileType ?? 'application/octet-stream'}
            fileName={ua.resourceFileName ?? 'fichier'}
            formationId={ua.formationId}
          />
        )}
      </main>
    </div>
  );
}

// ─── Resource inline panel (header + viewer 700px + retour) ──────────────────

function ResourceInlinePanel({
  resourceId,
  fileType,
  fileName,
  formationId,
}: {
  resourceId: string;
  fileType: string;
  fileName: string;
  formationId: string;
}) {
  // Préfère mémoïser : éviter de relancer l'effect interne du ResourceViewer
  // (qui dépend de fetchSignedUrl) à chaque rerender.
  const fetchSignedUrl = useCallback(async (id: string) => {
    const r = await api.get<{ data: { signedUrl: string } }>(`/player/resources/${id}/preview`);
    return r.data.signedUrl;
  }, []);

  async function handleDownload() {
    try {
      const r = await api.get<{ data: { signedUrl: string; fileName: string } }>(`/player/resources/${resourceId}/download`);
      const a = document.createElement('a');
      a.href = r.data.signedUrl;
      a.download = r.data.fileName || fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // Si le download échoue (par ex. UA_LOCKED), pas grand chose à faire ici ;
      // le viewer affiche déjà l'état de blocage de façon propre.
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-red-600">
            {fileType === 'application/pdf' ? 'PDF' : fileType.startsWith('image/') ? 'IMG' : fileType.startsWith('video/') ? 'VID' : 'DOC'}
          </span>
        </div>
        <p className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{fileName}</p>
        <button
          onClick={handleDownload}
          aria-label="Télécharger"
          className="flex items-center justify-center gap-1.5 px-3 text-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors flex-shrink-0 min-w-[44px] min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="hidden sm:inline">Télécharger</span>
        </button>
      </div>

      <ResourceViewer
        resourceId={resourceId}
        fileType={fileType}
        fileName={fileName}
        fetchSignedUrl={fetchSignedUrl}
        onDownload={handleDownload}
        eager
        height={700}
        backToFormationHref={`/formations/${formationId}`}
      />

      <div className="flex justify-center">
        <a
          href={`/formations/${formationId}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm min-h-[44px]"
        >
          Retour à la formation
        </a>
      </div>
    </div>
  );
}
