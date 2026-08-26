/** 20000 → « 20 000 DA » (groupement manuel : évite les écarts d'hydratation). */
export function formatDa(amount: number, locale: "fr" | "ar" = "fr"): string {
  const digits = Math.abs(Math.trunc(amount)).toString();
  const nbsp = "\u00A0";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
  return locale === "ar" ? `${grouped}${nbsp}دج` : `${grouped}${nbsp}DA`;
}
