/** 20000 → « 20 000 DA » (groupement manuel : évite les écarts d'hydratation). */
export function formatDa(amount: number, locale: 'fr' | 'ar' = 'fr'): string {
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return locale === 'ar' ? `${grouped} دج` : `${grouped} DA`;
}
