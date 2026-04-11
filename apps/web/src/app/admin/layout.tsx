'use client';

import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Tableau de bord', exact: true },
  { href: '/admin/formations', label: 'Formations' },
  { href: '/admin/apprenants', label: 'Apprenants' },
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
      <aside className="w-64 bg-gray-900 text-white p-6 flex-shrink-0">
        <a href="/admin" className="block mb-8">
          <h2 className="font-bold text-lg">Admin LMS</h2>
          <p className="text-xs text-gray-500">The Artist Academy</p>
        </a>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.href, item.exact)
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-gray-50 overflow-auto">{children}</main>
    </div>
  );
}
