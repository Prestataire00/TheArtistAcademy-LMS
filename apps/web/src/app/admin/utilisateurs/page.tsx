'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { SlideOver } from '@/components/SlideOver';
import { useToast } from '@/components/admin/ToastContext';

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export default function AdminUtilisateursPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const { showToast } = useToast();

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<{ data: StaffUser[] }>('/admin/utilisateurs')
      .then((res) => setUsers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleNameSave(user: StaffUser) {
    const trimmed = editingNameValue.trim();
    if (!trimmed || trimmed === user.fullName) { setEditingName(null); return; }
    try {
      await api.put(`/admin/utilisateurs/${user.id}`, { fullName: trimmed });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, fullName: trimmed } : u));
      showToast('Nom mis à jour', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
    setEditingName(null);
  }

  async function handleRoleChange(user: StaffUser, newRole: string) {
    try {
      await api.put(`/admin/utilisateurs/${user.id}`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
      showToast(`Rôle de ${user.fullName} mis à jour`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  async function handleResetPassword(user: StaffUser) {
    if (!confirm(`Réinitialiser le mot de passe de ${user.fullName} ?`)) return;
    try {
      const res = await api.put<{ data: StaffUser; tempPassword: string }>(`/admin/utilisateurs/${user.id}`, { resetPassword: true });
      setTempPassword({ email: user.email, password: res.tempPassword });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  async function handleDelete(user: StaffUser) {
    if (!confirm(`Supprimer le compte de ${user.fullName} (${user.email}) ?`)) return;
    try {
      await api.delete(`/admin/utilisateurs/${user.id}`);
      showToast('Utilisateur supprimé', 'success');
      loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (loading && users.length === 0) {
    return <div className="flex items-center gap-3 text-gray-500 py-12"><div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium">
          + Nouvel utilisateur
        </button>
      </div>

      {/* Modal mot de passe temporaire */}
      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Nouveau mot de passe</h3>
            <p className="text-sm text-gray-500 mb-3">Communiquez ce mot de passe temporaire a l'utilisateur. Il ne sera plus affiche.</p>
            <div className="mb-1 text-xs text-gray-400">{tempPassword.email}</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-lg text-center select-all mb-4">{tempPassword.password}</div>
            <button onClick={() => { setTempPassword(null); loadData(); }} className="w-full px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700">
              J'ai note le mot de passe
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserSlideOver
          onSave={() => { setShowCreate(false); loadData(); showToast('Utilisateur créé', 'success'); }}
          onClose={() => setShowCreate(false)}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {users.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucun utilisateur admin ou formateur.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500" style={{ width: 200, maxWidth: 200 }}>Nom</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Créé le</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Dernière connexion</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900" style={{ width: 200, maxWidth: 200 }}>
                    {editingName === u.id ? (
                      <input
                        autoFocus
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onBlur={() => handleNameSave(u)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(u); if (e.key === 'Escape') setEditingName(null); }}
                        className="w-full px-2 py-0.5 -ml-2 border border-brand-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 box-border"
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingName(u.id); setEditingNameValue(u.fullName); }}
                        className="cursor-pointer hover:underline hover:text-brand-700 transition-colors"
                      >{u.fullName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="trainer">Formateur</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{formatDate(u.lastSeenAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleResetPassword(u)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors">Réinit. mdp</button>
                      <button onClick={() => handleDelete(u)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Slide-over creation ────────────────────────────────────────────────────

function CreateUserSlideOver({ onSave, onClose, onError }: {
  onSave: () => void; onClose: () => void; onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'trainer'>('trainer');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      onError('Tous les champs sont requis');
      return;
    }
    if (password.length < 8) {
      onError('Le mot de passe doit contenir au moins 8 caracteres');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/utilisateurs', { fullName, email, password, role });
      onSave();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Erreur');
    }
    setSaving(false);
  }

  return (
    <SlideOver title="Nouvel utilisateur" onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Creation...' : 'Creer'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Jean Dupont" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="jean@example.fr" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="8 caracteres minimum" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'trainer')} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="trainer">Formateur</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
      </div>
    </SlideOver>
  );
}
