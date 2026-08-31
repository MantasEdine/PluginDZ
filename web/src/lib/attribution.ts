'use client';

/**
 * Attribution publicitaire côté navigateur. On mémorise, en cookie first-party, d'où
 * vient le visiteur (UTM ou identifiant de clic Google/Facebook) selon le principe du
 * « dernier contact » : chaque nouvelle campagne remplace la précédente. Cette étiquette
 * accompagne ensuite chaque page vue et la commande, pour alimenter le tableau
 * « Performance des campagnes » du back-office. Aucune donnée personnelle.
 */

const COOKIE = 'plugin_attrib';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export interface Attribution {
  source: string;
  medium: string;
  campaign: string | null;
}

/** Nettoie une étiquette : minuscules, sans accents, tirets à la place des espaces. */
function cleanTag(value: string | null | undefined, maxLen = 60): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : null;
}

/** Domaine référent externe (« www.google.com » -> « google.com »), null si interne/inconnu. */
function externalHost(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    const self = window.location.hostname.replace(/^www\./, '');
    if (!host || host === self) return null; // navigation interne : pas une source
    return host.toLowerCase().slice(0, 60);
  } catch {
    return null;
  }
}

function readCookie(): Attribution | null {
  const row = document.cookie.split('; ').find((r) => r.startsWith(`${COOKIE}=`));
  if (!row) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(row.slice(COOKIE.length + 1)));
    if (parsed && typeof parsed.source === 'string') return parsed as Attribution;
  } catch {
    /* cookie corrompu : ignoré */
  }
  return null;
}

function writeCookie(attrib: Attribution): void {
  const value = encodeURIComponent(JSON.stringify(attrib));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

/**
 * Met à jour l'attribution à partir de l'URL courante. Une campagne/source explicite
 * (UTM ou gclid/fbclid) remplace l'ancienne (dernier contact). En l'absence de tout
 * signal et de cookie existant, on fixe une première attribution depuis le référent.
 */
export function rememberAttributionFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const utmSource = cleanTag(params.get('utm_source'));
  const utmMedium = cleanTag(params.get('utm_medium'));
  const utmCampaign = cleanTag(params.get('utm_campaign'));
  const gclid = params.get('gclid');
  const fbclid = params.get('fbclid');
  const hasTouch = Boolean(utmSource || utmMedium || utmCampaign || gclid || fbclid);

  if (hasTouch) {
    let source = utmSource;
    if (!source) source = gclid ? 'google' : fbclid ? 'facebook' : externalHost(document.referrer) ?? 'direct';
    let medium = utmMedium;
    if (!medium) medium = gclid ? 'cpc' : fbclid ? 'social' : 'none';
    writeCookie({ source, medium, campaign: utmCampaign });
    return;
  }

  if (!readCookie()) {
    const host = externalHost(document.referrer);
    writeCookie({ source: host ?? 'direct', medium: 'none', campaign: null });
  }
}

/** Attribution mémorisée, pour l'envoyer avec une visite ou une commande. */
export function readAttribution(): Attribution | Record<string, never> {
  return readCookie() ?? {};
}
