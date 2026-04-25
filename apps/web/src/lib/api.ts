// Client fetch centralisé.
// - Ajoute les credentials (cookies httpOnly) pour le flow login admin/trainer
//   où le cookie 'token' est posé via Set-Cookie sur le domaine web.
// - Ajoute aussi un header Authorization: Bearer <token> depuis localStorage
//   pour le flow SSO Dendreo : l'API SSO pose le cookie sur SON domaine
//   (pas le web), donc le navigateur ne peut pas le renvoyer côté web. Le
//   token reçu via /sso/dendreo?token=... est stocké dans localStorage et
//   doit être présenté en header.
// Sans le header, le serveur tombe sur le cookie d'une session précédente
// (ex : un admin logué) et renvoie 400 "pas d'inscription active" car
// l'admin n'a pas d'enrollment sur la formation visée.

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  const token = readToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
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
