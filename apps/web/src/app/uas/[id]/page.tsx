'use client';

import { useEffect, useState } from 'react';
import { useParams, redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { VideoPlayer } from '@/components/VideoPlayer';

interface UAData {
  id: string;
  title: string;
  type: 'video' | 'quiz' | 'resource';
  formationId: string;
  formationTitle: string;
  durationSeconds: number | null;
}

export default function UAPage() {
  const params = useParams<{ id: string }>();
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
    <div className="min-h-screen bg-gray-50">
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
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Ressource — a venir</p>
          </div>
        )}
      </main>
    </div>
  );
}
