'use client';

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

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-dark text-white p-6 flex-shrink-0">
        <a href="/admin" className="block mb-8">
          <img src="/logo-light.png" alt="The Artist Academy" className="h-10 mb-2" />
          <p className="text-xs text-dark-muted">Administration</p>
        </a>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.href, item.exact)
                  ? 'bg-brand-600/20 text-brand-400 font-medium'
                  : 'text-dark-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-light overflow-auto">
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
