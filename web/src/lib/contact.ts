/**
 * Points de contact publics de la boutique, en un seul endroit.
 *
 * Le numéro WhatsApp est au format international sans « + » ni espaces, comme
 * l'exige wa.me. Les liens sociaux sont volontairement écrits sous leur forme
 * canonique : les URL copiées depuis l'application Facebook traînent des
 * paramètres de partage (mibextid, rdid, share_url…) qui identifient la session
 * de celui qui a copié le lien et n'ont rien à faire dans le code d'un site.
 */

/** Numéro WhatsApp de la boutique, format wa.me (indicatif sans « + »). */
export const WHATSAPP_NUMBER = '213549982823';

/** Même numéro, lisible par un humain. */
export const WHATSAPP_DISPLAY = '+213 549 98 28 23';

export const SOCIAL_LINKS = [
  { key: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61585542284025' },
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/pluginndz/' },
  { key: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@plugindz' },
] as const;

/** Lien WhatsApp avec un message pré-rempli (facultatif). */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
