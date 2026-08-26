/**
 * Formate un montant entier en dinars : 20000 → « 20 000 DA ».
 * Groupement fait à la main (espace simple) : `toLocaleString` produit des espaces
 * insécables qui diffèrent entre Node et le navigateur et cassent l'hydratation React.
 */
export function formatDa(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped} DA`;
}

/** Référence lisible d'une commande : PLG-000042 */
export function orderReference(id: number): string {
  return `PLG-${String(id).padStart(6, '0')}`;
}
