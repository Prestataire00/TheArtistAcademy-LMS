// Layout admin — guard rôle admin, navigation latérale
// Implémentation complète : Phase 2

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <h2 className="font-bold text-lg mb-6">Admin LMS</h2>
        <nav className="space-y-2 text-sm text-gray-300">
          <a href="/admin/formations" className="block hover:text-white">Formations</a>
          <a href="/admin/users" className="block hover:text-white">Apprenants</a>
          <a href="/admin/exports" className="block hover:text-white">Exports</a>
          <a href="/admin/reminders" className="block hover:text-white">Relances</a>
          <a href="/admin/sso" className="block hover:text-white">SSO / Diagnostic</a>
        </nav>
      </aside>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}
