'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Session {
  formationId: string;
  title: string;
  modulesCount: number;
  learnersCount: number;
  completionRate: number;
  completedCount: number;
  avgProgressPercent: number;
}

export default function FormateurSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Session[] }>('/formateur/sessions')
      .then((res) => setSessions(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mes sessions</h1>
              <p className="text-sm text-gray-500 mt-1">{sessions.length} formation{sessions.length > 1 ? 's' : ''}</p>
            </div>
            <a
              href="/formateur/contenus"
              className="px-4 py-2 text-sm font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
            >
              Gerer les contenus
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Aucune session avec des apprenants inscrits.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sessions.map((s) => (
              <a
                key={s.formationId}
                href={`/formateur/sessions/${s.formationId}`}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all group"
              >
                <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors mb-3">
                  {s.title}
                </h3>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  <span>{s.learnersCount} apprenant{s.learnersCount > 1 ? 's' : ''}</span>
                  <span>{s.modulesCount} module{s.modulesCount > 1 ? 's' : ''}</span>
                </div>

                {/* Progression bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progression moyenne</span>
                    <span className="font-medium">{s.avgProgressPercent ?? 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-brand-600 rounded-full transition-all"
                      style={{ width: `${s.avgProgressPercent ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {s.completedCount} / {s.learnersCount} termines
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
