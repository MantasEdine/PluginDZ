import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/error';
import { productInclude, serializeProduct } from '../lib/serialize';
import { WILAYAS } from '../lib/wilayas';

export const catalogRouter = Router();

/**
 * Un produit n'est visible en boutique que s'il est actif ET possède au moins une
 * déclinaison en stock. Toute la navigation « dérivée du stock » repose sur ce filtre.
 */
const inStockProduct = {
  isActive: true,
  variants: { some: { stock: { gt: 0 } } },
} as const;

catalogRouter.get(
  '/wilayas',
  asyncHandler(async (_req, res) => {
    res.json({ data: WILAYAS });
  }),
);

/** Marques ayant au moins un produit en stock, avec le nombre de produits. */
catalogRouter.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const includeEmpty = req.query.includeEmpty === 'true';
    const brands = await prisma.brand.findMany({
      where: includeEmpty ? {} : { products: { some: inStockProduct } },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: inStockProduct } } } },
    });

    res.json({
      data: brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        productCount: brand._count.products,
      })),
    });
  }),
);

/**
 * Détail d'une marque : uniquement les types de chargeurs qu'elle a réellement en
 * stock, et pour chacun les sous-types disponibles. Rien n'est codé en dur.
 */
catalogRouter.get(
  '/brands/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) throw HttpError.notFound('Marque introuvable');

    const types = await prisma.chargerType.findMany({
      where: { products: { some: { ...inStockProduct, brandId: brand.id } } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: { where: { ...inStockProduct, brandId: brand.id } } } },
      },
    });

    // Sous-types réellement présents, par type de chargeur.
    const subTypeRows = await prisma.product.findMany({
      where: { ...inStockProduct, brandId: brand.id, subType: { not: null } },
      select: { subType: true, chargerTypeId: true },
      distinct: ['subType', 'chargerTypeId'],
    });

    res.json({
      data: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        chargerTypes: types.map((type) => ({
          id: type.id,
          name: type.name,
          slug: type.slug,
          iconUrl: type.iconUrl,
          productCount: type._count.products,
          subTypes: subTypeRows
            .filter((row) => row.chargerTypeId === type.id && row.subType)
            .map((row) => row.subType as string)
            .sort((a, b) => a.localeCompare(b, 'fr')),
        })),
      },
    });
  }),
);

/** Types de chargeurs ayant du stock (toutes marques confondues). */
catalogRouter.get(
  '/charger-types',
  asyncHandler(async (req, res) => {
    const includeEmpty = req.query.includeEmpty === 'true';
    const types = await prisma.chargerType.findMany({
      where: includeEmpty ? {} : { products: { some: inStockProduct } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: inStockProduct } } } },
    });

    res.json({
      data: types.map((type) => ({
        id: type.id,
        name: type.name,
        slug: type.slug,
        iconUrl: type.iconUrl,
        productCount: type._count.products,
      })),
    });
  }),
);

/** Détail d'un type : marques et sous-types disponibles pour ce type. */
catalogRouter.get(
  '/charger-types/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const type = await prisma.chargerType.findUnique({ where: { slug } });
    if (!type) throw HttpError.notFound('Type de chargeur introuvable');

    const [brands, subTypes] = await Promise.all([
      prisma.brand.findMany({
        where: { products: { some: { ...inStockProduct, chargerTypeId: type.id } } },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { ...inStockProduct, chargerTypeId: type.id, subType: { not: null } },
        select: { subType: true },
        distinct: ['subType'],
      }),
    ]);

    res.json({
      data: {
        id: type.id,
        name: type.name,
        slug: type.slug,
        iconUrl: type.iconUrl,
        brands: brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl })),
        subTypes: subTypes
          .map((row) => row.subType as string)
          .sort((a, b) => a.localeCompare(b, 'fr')),
      },
    });
  }),
);

const listQuerySchema = z.object({
  brand: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  subType: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  promo: z.enum(['true', 'false']).optional(),
  sort: z.enum(['recent', 'prix-asc', 'prix-desc', 'promo']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

/** Grille de produits filtrée par marque / type / sous-type / recherche / promo. */
catalogRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);

    const where = {
      ...inStockProduct,
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.type ? { chargerType: { slug: query.type } } : {}),
      ...(query.subType ? { subType: query.subType } : {}),
      ...(query.promo === 'true' ? { isPromo: true } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
              { subType: { contains: query.search, mode: 'insensitive' as const } },
              { brand: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        // Le tri par prix / remise porte sur les déclinaisons : il se fait après
        // sérialisation, donc on pagine ensuite pour rester cohérent.
        ...(query.sort === 'recent'
          ? { skip: (query.page - 1) * query.perPage, take: query.perPage }
          : {}),
      }),
    ]);

    let products = rows.map((row) => serializeProduct(row));

    if (query.sort !== 'recent') {
      products.sort((a, b) => {
        if (query.sort === 'prix-asc') return (a.minPrice ?? 0) - (b.minPrice ?? 0);
        if (query.sort === 'prix-desc') return (b.minPrice ?? 0) - (a.minPrice ?? 0);
        return b.discountPercent - a.discountPercent;
      });
      const start = (query.page - 1) * query.perPage;
      products = products.slice(start, start + query.perPage);
    }

    res.json({
      data: products,
      meta: {
        total,
        page: query.page,
        perPage: query.perPage,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      },
    });
  }),
);

/** Promotions, meilleures remises en tête (page d'accueil). */
catalogRouter.get(
  '/promos',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 12, 48);
    const rows = await prisma.product.findMany({
      where: {
        ...inStockProduct,
        OR: [{ isPromo: true }, { variants: { some: { stock: { gt: 0 }, oldPrice: { not: null } } } }],
      },
      include: productInclude,
    });

    const products = rows
      .map((row) => serializeProduct(row))
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, limit);

    res.json({ data: products });
  }),
);

catalogRouter.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const product = await prisma.product.findUnique({ where: { slug }, include: productInclude });
    if (!product || !product.isActive) throw HttpError.notFound('Produit introuvable');

    const serialized = serializeProduct(product);

    // Produits proches : même type, autre produit, en stock.
    const related = await prisma.product.findMany({
      where: { ...inStockProduct, chargerTypeId: product.chargerTypeId, id: { not: product.id } },
      include: productInclude,
      take: 4,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: serialized,
      related: related.map((row) => serializeProduct(row)),
    });
  }),
);
