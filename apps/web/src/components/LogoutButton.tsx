'use client';

import { useState } from 'react';

interface Props {
  className?: string;
  label?: string;
}

export function LogoutButton({ className, label = 'Déconnexion' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    } finally {
      try { window.localStorage.removeItem('token'); } catch {}
      window.location.href = '/login';
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={className}
    >
      {loading ? 'Déconnexion...' : label}
    </button>
  );
}
