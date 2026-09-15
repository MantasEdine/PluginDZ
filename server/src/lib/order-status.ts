import { OrderStatus } from '@prisma/client';

/**
 * Règles métier attachées au statut d'une commande payée à la livraison.
 *
 * Deux notions distinctes, souvent confondues :
 *  - la marchandise est-elle revenue en rayon ? (annulation ET retour) ;
 *  - l'argent a-t-il été encaissé ? (seulement à la livraison).
 *
 * Les garder séparées évite le piège classique du paiement à la livraison :
 * compter comme chiffre d'affaires des colis partis mais jamais payés.
 */

/** Statuts où la marchandise n'est plus due au client : elle retourne en stock. */
export const STOCK_RELEASING_STATUSES: readonly OrderStatus[] = [
  OrderStatus.annule,
  OrderStatus.retourne,
];

/** La marchandise de cette commande doit-elle être en rayon (et non réservée) ? */
export function releasesStock(status: OrderStatus): boolean {
  return STOCK_RELEASING_STATUSES.includes(status);
}

/**
 * Statuts comptés dans le chiffre d'affaires.
 *
 * « livre » est le seul encaissement certain ; « confirme » et « expedie » sont
 * des ventes engagées, encore susceptibles de revenir. On les compte tous les
 * trois pour que le tableau de bord reflète l'activité en cours, mais « retourne »
 * et « annule » en sont exclus : un colis refusé n'a jamais rapporté un dinar.
 */
export const REVENUE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.confirme,
  OrderStatus.expedie,
  OrderStatus.livre,
];

/** Statuts qui comptent comme une vente perdue (pour le taux de retour). */
export const LOST_STATUSES: readonly OrderStatus[] = [
  OrderStatus.annule,
  OrderStatus.retourne,
];
