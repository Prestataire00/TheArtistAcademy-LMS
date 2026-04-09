// Page de réception du SSO Dendreo
// Reçoit le token JWT Dendreo via query param, l'envoie à l'API, redirige vers la formation
// Implémentation complète : Phase 0

import { redirect } from 'next/navigation';

interface SsoPageProps {
  searchParams: { token?: string };
}

export default async function SsoPage({ searchParams }: SsoPageProps) {
  const token = searchParams.token;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès non autorisé</h1>
          <p className="text-gray-500">
            Veuillez accéder à votre formation depuis votre espace Dendreo.
          </p>
        </div>
      </div>
    );
  }

  // TODO: Phase 0 — appeler POST /api/v1/auth/sso avec le token
  // et rediriger vers la formation

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Connexion en cours...</p>
    </div>
  );
}
