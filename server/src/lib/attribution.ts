/**
 * Normalisation de l'attribution publicitaire (UTM + identifiants de clic).
 * Partagé par le tracking d'audience et l'enregistrement des commandes, pour que la
 * source/medium/campagne d'une visite et d'une commande soient comparables à l'octet près.
 */

export interface RawAttribution {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  gclid?: string | null; // Google Ads
  fbclid?: string | null; // Facebook / Instagram
  referrer?: string | null;
}

export interface Attribution {
  source: string;
  medium: string;
  campaign: string | null;
}

/** Nettoie une valeur d'étiquette : minuscules, sans accents, tirets à la place des espaces. */
export function cleanTag(value: string | null | undefined, maxLen = 60): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '') // garde lettres/chiffres/. _ -
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : null;
}

/** Domaine référent normalisé (« www.google.com » -> « google.com »), sinon null. */
function referrerHost(referrer?: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    return host ? host.toLowerCase().slice(0, 60) : null;
  } catch {
    return null;
  }
}

/**
 * Déduit (source, medium, campagne) à partir des UTM et des identifiants de clic.
 * Priorité : UTM explicites > identifiant de clic (gclid/fbclid) > référent > « direct ».
 * Un gclid sans utm_campaign reste attribué à google/cpc, sans nom de campagne.
 */
export function deriveAttribution(raw: RawAttribution): Attribution {
  const utmSource = cleanTag(raw.source);
  const utmMedium = cleanTag(raw.medium);
  const campaign = cleanTag(raw.campaign);
  const hasGclid = Boolean(raw.gclid && String(raw.gclid).trim());
  const hasFbclid = Boolean(raw.fbclid && String(raw.fbclid).trim());

  let source = utmSource;
  if (!source) {
    if (hasGclid) source = 'google';
    else if (hasFbclid) source = 'facebook';
    else source = referrerHost(raw.referrer) ?? 'direct';
  }

  let medium = utmMedium;
  if (!medium) {
    if (hasGclid) medium = 'cpc';
    else if (hasFbclid) medium = 'social';
    else medium = 'none';
  }

  return { source, medium, campaign };
}
