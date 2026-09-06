'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { PUBLIC_API_URL } from '@/lib/api';
import { readAttribution, rememberAttributionFromUrl } from '@/lib/attribution';

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
 * Enregistre discrètement chaque page vue publique pour alimenter les tableaux
 * « Audience » et « Performance des campagnes » du back-office. Mémorise aussi
 * l'attribution publicitaire (UTM / gclid) en cookie, pour l'associer à la commande.
 * Ne fait rien sur les pages d'administration. Les échecs réseau sont ignorés.
 */
export function VisitTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;

    // Mémorise l'attribution dès l'arrivée (avant tout dédoublonnage de chemin) : un
    // même chemin peut être atteint via une nouvelle campagne après navigation interne.
    rememberAttributionFromUrl();

    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const attrib = readAttribution();
    fetch(`${PUBLIC_API_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getVisitorId(),
        path: pathname,
        referrer: document.referrer || undefined,
        ...attrib,
      }),
      keepalive: true,
    }).catch(() => {
      /* tracking best-effort : on ignore toute erreur */
    });
  }, [pathname]);

  return null;
}
