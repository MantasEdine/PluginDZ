'use client';

/**
 * Attribution publicitaire côté navigateur. On mémorise, en cookie first-party, d'où
 * vient le visiteur (UTM ou identifiant de clic Google/Facebook) selon le principe du
 * « dernier contact » : chaque nouvelle campagne remplace la précédente. Cette étiquette
 * accompagne ensuite chaque page vue et la commande, pour alimenter le tableau
 * « Performance des campagnes » du back-office. Aucune donnée personnelle.
 *
 * IMPORTANT — garder synchronisé avec server/src/lib/attribution.ts : le rapprochement
 * visites/commandes se fait sur les chaînes exactes (source, medium, campaign). Toute
 * évolution du nettoyage ou des règles de dérivation doit être répliquée des deux côtés.
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
 * Met à jour l'attribution à partir de l'URL courante (règle du dernier contact).
 *
 * Un marquage UTM délibéré (utm_source ou utm_campaign) remplace l'attribution
 * précédente en entier. En revanche, un simple identifiant de clic au retour (gclid /
 * fbclid seul, sans UTM) ne doit PAS écraser une campagne déjà mémorisée : sinon un
 * visiteur revenu via un lien Facebook « nu » perdrait la campagne qui l'avait amené,
 * et la commande ne serait plus rattachée à cette campagne. Ces identifiants de clic
 * ne servent donc qu'à fixer une toute première attribution.
 */
export function rememberAttributionFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const utmSource = cleanTag(params.get('utm_source'));
  const utmMedium = cleanTag(params.get('utm_medium'));
  const utmCampaign = cleanTag(params.get('utm_campaign'));
  const gclid = params.get('gclid');
  const fbclid = params.get('fbclid');
  const deliberateTag = Boolean(utmSource || utmCampaign); // marquage UTM volontaire
  const existing = readCookie();

  if (deliberateTag) {
    let source = utmSource;
    if (!source) source = gclid ? 'google' : fbclid ? 'facebook' : externalHost(document.referrer) ?? 'direct';
    let medium = utmMedium;
    if (!medium) medium = gclid ? 'cpc' : fbclid ? 'social' : 'none';
    writeCookie({ source, medium, campaign: utmCampaign });
    return;
  }

  // Pas de marquage UTM : on ne fixe une attribution que s'il n'en existe aucune.
  if (!existing) {
    if (gclid || fbclid) {
      writeCookie({
        source: gclid ? 'google' : 'facebook',
        medium: gclid ? 'cpc' : 'social',
        campaign: null,
      });
    } else {
      const host = externalHost(document.referrer);
      writeCookie({ source: host ?? 'direct', medium: 'none', campaign: null });
    }
  }
}

/** Attribution mémorisée, pour l'envoyer avec une visite ou une commande. */
export function readAttribution(): Attribution | Record<string, never> {
  return readCookie() ?? {};
}
