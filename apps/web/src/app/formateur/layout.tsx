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
      {/* Top-bar sticky pleine largeur : évite l'overlap visuel avec les
          headers internes des pages formateur (qui ont des max-widths
          variables 4xl/5xl/6xl, donc impossibles à aligner avec un overlay
          flottant). Boutons right-aligned, sépare clairement la chrome
          d'app du contenu de la page. */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-2">
          {showSwitchToAdmin && (
            <a
              href="/admin"
              className="px-3 py-1.5 text-xs font-medium text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors min-h-[36px] inline-flex items-center gap-1.5"
              aria-label="Basculer vers Espace administration"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18m0 0l-6-6m6 6l-6 6" />
              </svg>
              <span>Espace administration</span>
            </a>
          )}
          <LogoutButton className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[36px]" />
        </div>
      </div>
      {children}
    </>
  );
}
