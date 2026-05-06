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

  async function login(role: 'learner' | 'admin' | 'trainer') {
    setLoading(true);
    setError(null);

    const emails: Record<string, string> = {
      learner: 'test@artistacademy.fr',
      admin: 'admin@artistacademy.fr',
      trainer: 'formateur@artistacademy.fr',
    };
    const names: Record<string, string> = {
      learner: 'Apprenant Test',
      admin: 'Admin Test',
      trainer: 'Formateur Test',
    };
    const redirects: Record<string, string> = {
      learner: `/formations/${FORMATION_ID}`,
      admin: '/admin',
      trainer: '/formateur/sessions',
    };

    try {
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emails[role], roles: [role], fullName: names[role] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      const { token } = await res.json();
      localStorage.setItem('token', token);
      router.push(redirects[role]);
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
      padding: '1rem',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '1.5rem',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box',
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
              padding: '0.875rem 1rem',
              minHeight: '44px',
              backgroundColor: '#B5294E',
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
            onClick={() => login('trainer')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              minHeight: '44px',
              backgroundColor: '#52545F',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Se connecter en tant que formateur
          </button>

          <button
            onClick={() => login('admin')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              minHeight: '44px',
              backgroundColor: '#272831',
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

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#9ca3af', wordBreak: 'break-word' }}>
          test@artistacademy.fr → /formations/{FORMATION_ID.substring(0, 8)}...
        </p>
      </div>
    </div>
  );
}
