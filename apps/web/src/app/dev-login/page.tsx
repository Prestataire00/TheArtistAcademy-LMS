'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FORMATION_ID = 'cmnspkvdc00004w6ctrsd5my4';

export default function DevLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NODE_ENV !== 'development') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888' }}>Page disponible uniquement en developpement.</p>
      </div>
    );
  }

  async function login(role: 'learner' | 'admin') {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: role === 'admin' ? 'admin@artistacademy.fr' : 'test@artistacademy.fr',
          role,
          fullName: role === 'admin' ? 'Admin Test' : 'Apprenant Test',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      const { token } = await res.json();
      localStorage.setItem('token', token);

      if (role === 'admin') {
        router.push('/admin');
      } else {
        router.push(`/formations/${FORMATION_ID}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '2.5rem',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>
          Dev Login
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
          Connexion rapide pour le developpement
        </p>

        {error && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: '#b91c1c',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={() => login('learner')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#9333ea',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Connexion...' : "Se connecter en tant qu'apprenant test"}
          </button>

          <button
            onClick={() => login('admin')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#111827',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Se connecter en tant qu'admin
          </button>
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
          test@artistacademy.fr → /formations/{FORMATION_ID.substring(0, 8)}...
        </p>
      </div>
    </div>
  );
}
