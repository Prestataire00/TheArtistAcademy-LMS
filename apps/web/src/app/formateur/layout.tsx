'use client';

import { LogoutButton } from '@/components/LogoutButton';
import { useUserContext } from '@/lib/useUserContext';

export default function FormateurLayout({ children }: { children: React.ReactNode }) {
  const { role } = useUserContext();

  // Le bouton "Espace administration" n'a de sens que pour un user qui a
  // accès au back-office admin. Un trainer pur n'a pas /admin → pas de
  // bouton. La condition est sur le rôle (et pas sur l'assignation,
  // contrairement au sens admin → formateur) car un admin/superadmin a
  // toujours accès à /admin, quelle que soit son assignation.
  const showSwitchToAdmin = role === 'admin' || role === 'superadmin';

  return (
    <>
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        {showSwitchToAdmin && (
          <a
            href="/admin"
            className="px-3 py-2 text-xs font-medium text-brand-700 bg-white/90 backdrop-blur border border-brand-200 rounded-lg shadow-sm hover:bg-brand-50 transition-colors min-h-[36px] inline-flex items-center gap-1.5"
            aria-label="Basculer vers Espace administration"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18m0 0l-6-6m6 6l-6 6" />
            </svg>
            <span>Espace administration</span>
          </a>
        )}
        <LogoutButton className="px-3 py-2 text-xs font-medium text-gray-600 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm hover:bg-white hover:text-gray-900 transition-colors min-h-[36px]" />
      </div>
      {children}
    </>
  );
}
