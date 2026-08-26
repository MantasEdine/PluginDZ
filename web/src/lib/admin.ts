'use client';

import { PUBLIC_API_URL } from './api';

const TOKEN_KEY = 'plugin_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Appel authentifié au back-office. Un 401 purge le jeton et renvoie vers la
 * page de connexion — la session a expiré.
 */
export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const isFormData = init.body instanceof FormData;

  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/admin/login';
    throw new Error('Session expirée');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? 'Erreur serveur');
  return payload as T;
}
