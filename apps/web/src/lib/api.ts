// Client fetch centralisé.
// (redeploy trigger — credentials omit fix bundle)
//
// Stratégie d'auth (simple et robuste) :
//   - Si localStorage.token existe -> on envoie UNIQUEMENT le header
//     `Authorization: Bearer <token>` et on omet les cookies (`credentials:omit`).
//     Ça empêche un cookie résiduel d'une session précédente (ex : trainer
//     loggé avant le SSO apprenant) d'écraser l'identité explicite du token.
//   - Sinon (pas de token en localStorage) on retombe sur `credentials:include`
//     pour le flow login admin/trainer où le cookie `token` est posé via
//     Set-Cookie sur le domaine web.
//
// Le SSO Dendreo pose le token via /sso/dendreo?token=... → localStorage.
// Le login admin/trainer pose le token via cookie httpOnly + également
// localStorage côté client (le 1er moyen suffira).

const BASE_URL = '/api/v1';

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = readToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 'omit' quand on a un token explicite : évite de laisser un cookie
  // résiduel (autre user) écraser notre identité côté serveur.
  // 'include' sinon : nécessaire pour le flow login (cookie httpOnly).
  const credentials: RequestCredentials = token ? 'omit' : 'include';

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  // 204 No Content — pas de body
  if (res.status === 204) return {} as T;

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
