'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Page de relais SSO Dendreo. L'API redirige ici avec :
//   /sso/dendreo?token=xxx&training_id=xxx&enrolment_id=xxx
// On stocke le token côté navigateur (localStorage, lu par lib/api.ts) puis
// on redirige immédiatement vers /formations/[id] sans afficher de UI
// intermédiaire (le 'Connexion...' n'est qu'un fallback si JS lent).

export default function SsoDendreoPage() {
  return (
    <Suspense fallback={null}>
      <SsoDendreoInner />
    </Suspense>
  );
}

function SsoDendreoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const trainingId = searchParams.get('training_id');

    if (!token || !trainingId) {
      // Pas de token = arrivée directe non autorisée -> retour login.
      router.replace('/login');
      return;
    }

    try {
      localStorage.setItem('token', token);
    } catch {
      // Si localStorage est désactivé, on continue : le cookie côté API
      // (set par GET /auth/sso) pourra encore servir si même domaine.
    }

    router.replace(`/formations/${trainingId}`);
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
