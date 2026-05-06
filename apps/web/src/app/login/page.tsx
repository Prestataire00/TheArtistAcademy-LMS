'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Purge un éventuel token résiduel d'une session précédente (ex : SSO
      // apprenant testé avant). Sans ça, api.ts enverrait l'ancien Bearer.
      try { window.localStorage.removeItem('token'); } catch {}

      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error?.message || `Erreur ${res.status}`);
      }

      // Stocker le token en localStorage pour que api.ts envoie un
      // Authorization: Bearer cohérent (même mécanisme que le SSO apprenant).
      if (data.token) {
        try { window.localStorage.setItem('token', data.token); } catch {}
      }

      // Redirection selon les rôles. Priorité admin/superadmin > trainer >
      // learner : un user staff cumulant plusieurs rôles atterrit d'abord
      // sur la console la plus permissive (l'admin couvre la gestion ; un
      // formateur-admin doit voir l'admin par défaut). Il pourra naviguer
      // vers les autres espaces ensuite.
      const roles: string[] = data.user?.roles ?? [];
      if (roles.some((r) => r === 'admin' || r === 'superadmin')) {
        router.push('/admin');
      } else if (roles.includes('trainer')) {
        router.push('/formateur/sessions');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-dark.png" alt="The Artist Academy" className="h-16 sm:h-20 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Connexion</h1>
          <p className="text-sm text-gray-500 mt-1">Espace formateur et administrateur</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-[44px]"
              placeholder="votre@email.fr"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-[44px]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 flex items-center justify-center w-10 h-10"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="w-full text-center text-xs text-gray-500 hover:text-brand-600 transition-colors py-2 min-h-[44px]"
          >
            Mot de passe oublié ?
          </button>
        </form>

        {showForgot && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
            <p className="font-medium text-gray-900 mb-3 text-sm">Réinitialisation du mot de passe</p>
            {forgotSent ? (
              <div>
                <p className="text-sm text-gray-600 mb-3">Si cette adresse est connue, un email contenant un lien de reinitialisation a ete envoye.</p>
                <button onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium py-2 min-h-[44px]">Retour à la connexion</button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-[44px]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowForgot(false); setForgotEmail(''); }}
                    className="flex-1 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg min-h-[44px]"
                  >Annuler</button>
                  <button
                    disabled={forgotLoading || !forgotEmail}
                    onClick={async () => {
                      setForgotLoading(true);
                      try {
                        await fetch('/api/v1/auth/forgot-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: forgotEmail }),
                        });
                      } catch {}
                      setForgotLoading(false);
                      setForgotSent(true);
                    }}
                    className="flex-1 px-3 py-2.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 min-h-[44px]"
                  >{forgotLoading ? 'Envoi...' : 'Envoyer'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Apprenants : connectez-vous via votre espace Dendreo.
        </p>
      </div>
    </div>
  );
}
