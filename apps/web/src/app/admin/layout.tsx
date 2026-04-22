'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ToastProvider } from '@/components/admin/ToastContext';

const navItems = [
  { href: '/admin', label: 'Tableau de bord', exact: true },
  { href: '/admin/formations', label: 'Formations' },
  { href: '/admin/apprenants', label: 'Apprenants' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/exports', label: 'Exports' },
  { href: '/admin/relances', label: 'Relances' },
  { href: '/admin/sso', label: 'SSO / Diagnostic' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll + close on ESC while drawer open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const navLinks = (onClick?: () => void) => (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={`block px-3 py-3 md:py-2 rounded-lg text-sm transition-colors min-h-[44px] md:min-h-0 flex md:block items-center ${
            isActive(item.href, item.exact)
              ? 'bg-brand-600/20 text-brand-400 font-medium'
              : 'text-dark-muted hover:text-white hover:bg-white/5'
          }`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* ─── Mobile topbar ────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-dark text-white px-4 h-14 border-b border-white/10">
        <a href="/admin" className="flex items-center">
          <img src="/logo-light.png" alt="The Artist Academy" className="h-8 w-auto" />
        </a>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={drawerOpen}
          aria-controls="admin-mobile-drawer"
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* ─── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="hidden md:block w-64 bg-dark text-white p-6 flex-shrink-0">
        <a href="/admin" className="block mb-8">
          <img src="/logo-light.png" alt="The Artist Academy" className="h-14 w-auto mb-2" />
          <p className="text-xs text-dark-muted">Administration</p>
        </a>
        {navLinks()}
      </aside>

      {/* ─── Mobile drawer + backdrop ─────────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="admin-mobile-drawer"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-dark text-white p-6 overflow-y-auto shadow-xl"
          >
            <div className="flex items-start justify-between mb-8">
              <a href="/admin" onClick={() => setDrawerOpen(false)} className="block">
                <img src="/logo-light.png" alt="The Artist Academy" className="h-12 w-auto mb-2" />
                <p className="text-xs text-dark-muted">Administration</p>
              </a>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 -mr-2"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {navLinks(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* ─── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 bg-light overflow-auto min-w-0">
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
