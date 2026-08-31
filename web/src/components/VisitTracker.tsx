'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { PUBLIC_API_URL } from '@/lib/api';

const VID_COOKIE = 'plugin_vid';
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Identifiant anonyme de navigateur (cookie first-party). Aucune donnée personnelle. */
function getVisitorId(): string {
  const found = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${VID_COOKIE}=`));
  if (found) return found.slice(VID_COOKIE.length + 1);

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${VID_COOKIE}=${id}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
  return id;
}

/**
 * Enregistre discrètement chaque page vue publique pour alimenter le tableau de bord
 * « Audience » du back-office. Ne fait rien sur les pages d'administration. Les échecs
 * réseau sont ignorés : le tracking ne doit jamais gêner la navigation.
 */
export function VisitTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    // Évite un double envoi pour un même chemin (StrictMode, re-render).
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source') ?? undefined;
    const referrer = document.referrer || undefined;

    fetch(`${PUBLIC_API_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), path: pathname, referrer, source }),
      keepalive: true,
    }).catch(() => {
      /* tracking best-effort : on ignore toute erreur */
    });
  }, [pathname]);

  return null;
}
