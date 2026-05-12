'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Ancienne route SSO (compat). On garde cette page comme alias de /sso/dendreo
// au cas où des liens externes pointent encore ici. Comportement identique :
// stocke le token, redirige vers la formation.

export default function AuthSsoPage() {
  return (
    <Suspense fallback={null}>
      <AuthSsoInner />
    </Suspense>
  );
}

function AuthSsoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token') ?? searchParams.get('jwt');
    const trainingId = searchParams.get('training_id');

    if (!token) {
      router.replace('/login');
      return;
    }

    // Purge le cookie API d'une session précédente avant d'installer ce token.
    // Évite que cookie et localStorage pointent sur deux identités différentes.
    (async () => {
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
      } catch { /* ignore */ }

      try {
        localStorage.setItem('token', token);
      } catch {
        /* ignore */
      }

      router.replace(trainingId ? `/formations/${trainingId}` : '/');
    })();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-light">
      <div className="flex items-center gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        Connexion...
      </div>
    </div>
  );
}
