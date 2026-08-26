import type { Prisma } from '@prisma/client';

export const productInclude = {
  brand: true,
  chargerType: true,
  variants: { orderBy: [{ isDefault: 'desc' }, { price: 'asc' }] },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface SerializedVariant {
  id: number;
  color: string | null;
  power: string | null;
  plugType: string | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  sku: string | null;
  imageUrl: string | null;
  isDefault: boolean;
  label: string;
}

/** Libellé lisible d'une déclinaison : « Blanc · 20W · EU ». */
export function variantLabel(variant: {
  color: string | null;
  power: string | null;
  plugType: string | null;
}): string {
  const parts = [variant.color, variant.power, variant.plugType].filter(Boolean) as string[];
  return parts.join(' · ');
}

function serializeVariant(variant: ProductWithRelations['variants'][number]): SerializedVariant {
  return {
    id: variant.id,
    color: variant.color,
    power: variant.power,
    plugType: variant.plugType,
    price: variant.price,
    oldPrice: variant.oldPrice,
    stock: variant.stock,
    sku: variant.sku,
    imageUrl: variant.imageUrl,
    isDefault: variant.isDefault,
    label: variantLabel(variant),
  };
}

/**
 * Met le produit en forme pour le storefront.
 * `onlyInStock` masque les déclinaisons épuisées (règle métier : stock 0 = invisible).
 */
export function serializeProduct(product: ProductWithRelations, onlyInStock = true) {
  const variants = (onlyInStock ? product.variants.filter((v) => v.stock > 0) : product.variants).map(
    serializeVariant,
  );
  const prices = variants.map((v) => v.price);
  const discounts = variants
    .filter((v) => v.oldPrice && v.oldPrice > v.price)
    .map((v) => Math.round((1 - v.price / (v.oldPrice as number)) * 100));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    subType: product.subType,
    description: product.description,
    imageUrl: product.imageUrl,
    isPromo: product.isPromo,
    isActive: product.isActive,
    createdAt: product.createdAt,
    brand: { id: product.brand.id, name: product.brand.name, slug: product.brand.slug, logoUrl: product.brand.logoUrl },
    chargerType: { id: product.chargerType.id, name: product.chargerType.name, slug: product.chargerType.slug },
    variants,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
    /** Meilleure remise en % — sert à trier les promos, les plus fortes en premier. */
    discountPercent: discounts.length ? Math.max(...discounts) : 0,
  };
}

export type SerializedProduct = ReturnType<typeof serializeProduct>;

export const packInclude = {
  items: {
    include: {
      variant: { include: { product: { include: { brand: true, chargerType: true } } } },
    },
  },
} satisfies Prisma.PackInclude;

type PackWithItems = Prisma.PackGetPayload<{ include: typeof packInclude }>;

export function serializePack(pack: PackWithItems) {
  const items = pack.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    variantId: item.variantId,
    unitPrice: item.variant.price,
    label: [item.variant.product.name, variantLabel(item.variant)].filter(Boolean).join(' — '),
    productSlug: item.variant.product.slug,
    imageUrl: item.variant.imageUrl ?? item.variant.product.imageUrl,
    brand: item.variant.product.brand.name,
  }));

  /** Valeur du pack acheté à l'unité — sert à afficher l'économie réalisée. */
  const unitValue = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: pack.id,
    name: pack.name,
    slug: pack.slug,
    price: pack.price,
    oldPrice: pack.oldPrice,
    description: pack.description,
    imageUrl: pack.imageUrl,
    stock: pack.stock,
    isFeatured: pack.isFeatured,
    isActive: pack.isActive,
    createdAt: pack.createdAt,
    items,
    totalUnits,
    unitValue,
    savings: unitValue > pack.price ? unitValue - pack.price : 0,
  };
}

export type SerializedPack = ReturnType<typeof serializePack>;
