/** Transforme « Chargeur Téléphone 20W » en « chargeur-telephone-20w ». */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Garantit l'unicité d'un slug en suffixant -2, -3... tant que `exists` renvoie vrai.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';
  let candidate = root;
  let counter = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
  }
  return candidate;
}
