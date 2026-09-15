/**
 * Normalisation des numéros de téléphone algériens.
 *
 * Un même abonné peut écrire son numéro de plusieurs façons toutes valides :
 * « 0661 23 45 67 », « +213661234567 », « 00213661234567 ». Elles désignent la
 * même ligne, donc elles doivent être traitées comme identiques — sinon un client
 * qui a commandé avec l'indicatif international ne retrouve pas sa commande quand
 * il tape son numéro au format national dans le suivi.
 *
 * On ramène tout à la forme nationale « 0XXXXXXXXX » (10 chiffres), qui est celle
 * que les clients lisent et que le livreur compose.
 */

/** Motif accepté à la saisie : 05/06/07 + 8 chiffres, avec ou sans indicatif +213. */
export const ALGERIAN_PHONE = /^(?:\+213|00213|0)(?:5|6|7)\d{8}$/;

/**
 * Forme canonique d'un numéro : espaces et séparateurs retirés, indicatif
 * international remplacé par le 0 national. Les numéros non reconnus sont
 * renvoyés simplement débarrassés de leurs séparateurs (on ne perd rien).
 */
export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+213')) return `0${compact.slice(4)}`;
  if (compact.startsWith('00213')) return `0${compact.slice(5)}`;
  if (compact.startsWith('213') && compact.length === 12) return `0${compact.slice(3)}`;
  return compact;
}

/** Deux saisies désignent-elles la même ligne, quel que soit leur format ? */
export function samePhone(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}
