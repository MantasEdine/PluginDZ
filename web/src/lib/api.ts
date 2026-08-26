/** URL de l'API : côté serveur on peut viser une adresse interne. */
export const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000'
).replace(/\/$/, '');

export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? API_URL).replace(/\/$/, '');

export interface Variant {
  id: number; color: string | null; power: string | null; plugType: string | null;
  price: number; oldPrice: number | null; stock: number; sku: string | null;
  imageUrl: string | null; isDefault: boolean; label: string;
}

export interface Product {
  id: number; name: string; slug: string; subType: string | null; description: string;
  imageUrl: string | null; isPromo: boolean; createdAt: string;
  brand: { id: number; name: string; slug: string; logoUrl: string | null };
  chargerType: { id: number; name: string; slug: string };
  variants: Variant[];
  minPrice: number | null; maxPrice: number | null; totalStock: number; discountPercent: number;
}

export interface PackItem {
  id: number; quantity: number; variantId: number; unitPrice: number;
  label: string; productSlug: string; imageUrl: string | null; brand: string;
}

export interface Pack {
  id: number; name: string; slug: string; price: number; oldPrice: number | null;
  description: string; imageUrl: string | null; stock: number; isFeatured: boolean;
  items: PackItem[]; totalUnits: number; unitValue: number; savings: number;
}

export interface BrandSummary {
  id: number; name: string; slug: string; logoUrl: string | null; productCount: number;
}

export interface ChargerTypeSummary {
  id: number; name: string; slug: string; iconUrl: string | null;
  productCount: number; subTypes?: string[];
}

export interface Wilaya { code: number; name: string }

interface Envelope<T> { data: T; meta?: { total: number; page: number; perPage: number; pageCount: number }; related?: T }

/**
 * Appel API pour les composants serveur. `revalidate: 60` : le catalogue bouge peu,
 * une minute de cache suffit et allège la base.
 */
async function get<T>(path: string, revalidate = 60): Promise<Envelope<T> | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!response.ok) return null;
    return (await response.json()) as Envelope<T>;
  } catch {
    // L'API peut être injoignable au build : la page se rend vide plutôt que d'échouer.
    return null;
  }
}

export const api = {
  brands: () => get<BrandSummary[]>('/api/brands'),
  brand: (slug: string) => get<BrandSummary & { chargerTypes: ChargerTypeSummary[] }>(`/api/brands/${slug}`),
  chargerTypes: () => get<ChargerTypeSummary[]>('/api/charger-types'),
  chargerType: (slug: string) =>
    get<ChargerTypeSummary & { brands: BrandSummary[]; subTypes: string[] }>(`/api/charger-types/${slug}`),
  products: (query: string) => get<Product[]>(`/api/products${query}`),
  product: (slug: string) => get<Product>(`/api/products/${slug}`),
  promos: (limit = 8) => get<Product[]>(`/api/promos?limit=${limit}`),
  packs: (featured = false) => get<Pack[]>(`/api/packs${featured ? '?featured=true' : ''}`),
  pack: (slug: string) => get<Pack>(`/api/packs/${slug}`),
  wilayas: () => get<Wilaya[]>('/api/wilayas', 86400),
};

/** Meilleure image disponible pour un produit / une déclinaison. */
export function productImage(product: Product, variant?: Variant | null): string | null {
  return variant?.imageUrl ?? product.imageUrl ?? product.variants.find((v) => v.imageUrl)?.imageUrl ?? null;
}
