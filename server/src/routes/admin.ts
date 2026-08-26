import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/error';
import { requireAdmin, requireOwner } from '../middleware/auth';
import { uniqueSlug } from '../lib/slug';
import { packInclude, productInclude, serializePack, serializeProduct } from '../lib/serialize';

export const adminRouter = Router();

// Tout le back-office est protégé.
adminRouter.use(requireAdmin);

/* ------------------------------------------------------------------ tableau de bord */

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [newOrders, totalOrders, products, packs, lowStock, revenue] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.nouveau } }),
      prisma.order.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.pack.count({ where: { isActive: true } }),
      prisma.productVariant.count({ where: { stock: { lte: 5 } } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: [OrderStatus.confirme, OrderStatus.expedie] } },
      }),
    ]);

    res.json({
      data: {
        newOrders,
        totalOrders,
        products,
        packs,
        lowStock,
        confirmedRevenue: revenue._sum.total ?? 0,
      },
    });
  }),
);

/* ------------------------------------------------------------------------- marques */

const brandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  logoUrl: z.string().trim().max(500).optional().nullable(),
});

adminRouter.get(
  '/brands',
  asyncHandler(async (_req, res) => {
    const brands = await prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json({
      data: brands.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        productCount: b._count.products,
      })),
    });
  }),
);

adminRouter.post(
  '/brands',
  asyncHandler(async (req, res) => {
    const body = brandSchema.parse(req.body);
    const slug = await uniqueSlug(body.name, async (candidate) =>
      Boolean(await prisma.brand.findUnique({ where: { slug: candidate } })),
    );
    const brand = await prisma.brand.create({
      data: { name: body.name, slug, logoUrl: body.logoUrl || null },
    });
    res.status(201).json({ data: brand });
  }),
);

adminRouter.patch(
  '/brands/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = brandSchema.partial().parse(req.body);
    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl || null } : {}),
      },
    });
    res.json({ data: brand });
  }),
);

adminRouter.delete(
  '/brands/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const count = await prisma.product.count({ where: { brandId: id } });
    if (count > 0) {
      throw HttpError.conflict(`Cette marque a encore ${count} produit(s) — supprimez-les d'abord`);
    }
    await prisma.brand.delete({ where: { id } });
    res.json({ data: { message: 'Marque supprimée' } });
  }),
);

/* -------------------------------------------------------------- types de chargeurs */

const typeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  position: z.coerce.number().int().min(0).max(999).optional(),
});

adminRouter.get(
  '/charger-types',
  asyncHandler(async (_req, res) => {
    const types = await prisma.chargerType.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    res.json({
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        iconUrl: t.iconUrl,
        position: t.position,
        productCount: t._count.products,
      })),
    });
  }),
);

adminRouter.post(
  '/charger-types',
  asyncHandler(async (req, res) => {
    const body = typeSchema.parse(req.body);
    const slug = await uniqueSlug(body.name, async (candidate) =>
      Boolean(await prisma.chargerType.findUnique({ where: { slug: candidate } })),
    );
    const type = await prisma.chargerType.create({
      data: {
        name: body.name,
        slug,
        iconUrl: body.iconUrl || null,
        position: body.position ?? 0,
      },
    });
    res.status(201).json({ data: type });
  }),
);

adminRouter.patch(
  '/charger-types/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = typeSchema.partial().parse(req.body);
    const type = await prisma.chargerType.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.iconUrl !== undefined ? { iconUrl: body.iconUrl || null } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      },
    });
    res.json({ data: type });
  }),
);

adminRouter.delete(
  '/charger-types/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const count = await prisma.product.count({ where: { chargerTypeId: id } });
    if (count > 0) {
      throw HttpError.conflict(`Ce type a encore ${count} produit(s) — supprimez-les d'abord`);
    }
    await prisma.chargerType.delete({ where: { id } });
    res.json({ data: { message: 'Type supprimé' } });
  }),
);

/* ------------------------------------------------------------------------ produits */

const variantSchema = z.object({
  /** Présent lors d'une mise à jour : permet de conserver la déclinaison existante. */
  id: z.coerce.number().int().positive().optional(),
  color: z.string().trim().max(60).optional().nullable(),
  power: z.string().trim().max(60).optional().nullable(),
  plugType: z.string().trim().max(60).optional().nullable(),
  price: z.coerce.number().int().min(0).max(100_000_000),
  oldPrice: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  sku: z.string().trim().max(60).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brandId: z.coerce.number().int().positive(),
  chargerTypeId: z.coerce.number().int().positive(),
  subType: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(8000).optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isPromo: z.boolean().optional(),
  isActive: z.boolean().optional(),
  /**
   * Déclinaisons. Un produit « prix unique » se crée avec une seule entrée sans
   * couleur/puissance/prise : c'est la ligne par défaut.
   */
  variants: z.array(variantSchema).min(1, 'Au moins un prix (déclinaison) est requis'),
});

function nullify(value: string | null | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

adminRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        search: z.string().trim().optional(),
        brandId: z.coerce.number().int().positive().optional(),
        chargerTypeId: z.coerce.number().int().positive().optional(),
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);

    const where: Prisma.ProductWhereInput = {
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.chargerTypeId ? { chargerTypeId: query.chargerTypeId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { subType: { contains: query.search, mode: 'insensitive' } },
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
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);

    // `false` : le back-office voit aussi les déclinaisons épuisées.
    res.json({
      data: rows.map((row) => serializeProduct(row, false)),
      meta: {
        total,
        page: query.page,
        perPage: query.perPage,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      },
    });
  }),
);

adminRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) throw HttpError.notFound('Produit introuvable');
    res.json({ data: serializeProduct(product, false) });
  }),
);

adminRouter.post(
  '/products',
  asyncHandler(async (req, res) => {
    const body = productSchema.parse(req.body);
    const slug = await uniqueSlug(body.name, async (candidate) =>
      Boolean(await prisma.product.findUnique({ where: { slug: candidate } })),
    );

    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug,
        brandId: body.brandId,
        chargerTypeId: body.chargerTypeId,
        subType: nullify(body.subType),
        description: body.description ?? '',
        imageUrl: nullify(body.imageUrl),
        isPromo: body.isPromo ?? false,
        isActive: body.isActive ?? true,
        variants: {
          create: body.variants.map((variant, index) => ({
            color: nullify(variant.color),
            power: nullify(variant.power),
            plugType: nullify(variant.plugType),
            price: variant.price,
            oldPrice: variant.oldPrice ?? null,
            stock: variant.stock,
            sku: nullify(variant.sku),
            imageUrl: nullify(variant.imageUrl),
            isDefault: variant.isDefault ?? index === 0,
          })),
        },
      },
      include: productInclude,
    });

    res.status(201).json({ data: serializeProduct(product, false) });
  }),
);

adminRouter.patch(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = productSchema.partial().parse(req.body);

    const existing = await prisma.product.findUnique({ where: { id }, include: { variants: true } });
    if (!existing) throw HttpError.notFound('Produit introuvable');

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.brandId ? { brandId: body.brandId } : {}),
          ...(body.chargerTypeId ? { chargerTypeId: body.chargerTypeId } : {}),
          ...(body.subType !== undefined ? { subType: nullify(body.subType) } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: nullify(body.imageUrl) } : {}),
          ...(body.isPromo !== undefined ? { isPromo: body.isPromo } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });

      // Les déclinaisons ne sont remplacées que si le client en envoie.
      if (body.variants) {
        const keptIds = new Set<number>();
        for (const [index, variant] of body.variants.entries()) {
          const data = {
            color: nullify(variant.color),
            power: nullify(variant.power),
            plugType: nullify(variant.plugType),
            price: variant.price,
            oldPrice: variant.oldPrice ?? null,
            stock: variant.stock,
            sku: nullify(variant.sku),
            imageUrl: nullify(variant.imageUrl),
            isDefault: variant.isDefault ?? index === 0,
          };
          const existingId = variant.id;
          if (existingId && existing.variants.some((v) => v.id === existingId)) {
            await tx.productVariant.update({ where: { id: existingId }, data });
            keptIds.add(existingId);
          } else {
            const created = await tx.productVariant.create({ data: { ...data, productId: id } });
            keptIds.add(created.id);
          }
        }

        // Une déclinaison déjà commandée n'est pas supprimée : elle est mise à 0
        // pour ne pas casser l'historique des commandes.
        for (const variant of existing.variants) {
          if (keptIds.has(variant.id)) continue;
          const used = await tx.orderItem.count({ where: { variantId: variant.id } });
          const inPack = await tx.packItem.count({ where: { variantId: variant.id } });
          if (used > 0 || inPack > 0) {
            await tx.productVariant.update({ where: { id: variant.id }, data: { stock: 0 } });
          } else {
            await tx.productVariant.delete({ where: { id: variant.id } });
          }
        }
      }

      return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
    });

    res.json({ data: serializeProduct(updated, false) });
  }),
);

adminRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const ordered = await prisma.orderItem.count({ where: { variant: { productId: id } } });
    if (ordered > 0) {
      // On désactive au lieu de supprimer : les commandes passées doivent rester lisibles.
      await prisma.$transaction([
        prisma.product.update({ where: { id }, data: { isActive: false } }),
        prisma.productVariant.updateMany({ where: { productId: id }, data: { stock: 0 } }),
      ]);
      res.json({ data: { message: 'Produit déjà commandé : désactivé et mis hors stock' } });
      return;
    }
    await prisma.product.delete({ where: { id } });
    res.json({ data: { message: 'Produit supprimé' } });
  }),
);

/* --------------------------------------------------------------------------- packs */

const packSchema = z.object({
  name: z.string().trim().min(2).max(160),
  price: z.coerce.number().int().min(0).max(100_000_000),
  oldPrice: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  description: z.string().trim().max(8000).optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z
    .array(
      z.object({
        variantId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(10_000),
      }),
    )
    .min(1, 'Un pack doit contenir au moins un article'),
});

adminRouter.get(
  '/packs',
  asyncHandler(async (_req, res) => {
    const packs = await prisma.pack.findMany({ include: packInclude, orderBy: { createdAt: 'desc' } });
    res.json({ data: packs.map(serializePack) });
  }),
);

adminRouter.get(
  '/packs/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const pack = await prisma.pack.findUnique({ where: { id }, include: packInclude });
    if (!pack) throw HttpError.notFound('Pack introuvable');
    res.json({ data: serializePack(pack) });
  }),
);

/** Regroupe les doublons de déclinaison (contrainte d'unicité pack+variant). */
function mergePackItems(items: { variantId: number; quantity: number }[]) {
  const merged = new Map<number, number>();
  for (const item of items) {
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

adminRouter.post(
  '/packs',
  asyncHandler(async (req, res) => {
    const body = packSchema.parse(req.body);
    const slug = await uniqueSlug(body.name, async (candidate) =>
      Boolean(await prisma.pack.findUnique({ where: { slug: candidate } })),
    );

    const pack = await prisma.pack.create({
      data: {
        name: body.name,
        slug,
        price: body.price,
        oldPrice: body.oldPrice ?? null,
        description: body.description ?? '',
        imageUrl: nullify(body.imageUrl),
        stock: body.stock,
        isFeatured: body.isFeatured ?? false,
        isActive: body.isActive ?? true,
        items: { create: mergePackItems(body.items) },
      },
      include: packInclude,
    });

    res.status(201).json({ data: serializePack(pack) });
  }),
);

adminRouter.patch(
  '/packs/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = packSchema.partial().parse(req.body);

    const pack = await prisma.$transaction(async (tx) => {
      await tx.pack.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.price !== undefined ? { price: body.price } : {}),
          ...(body.oldPrice !== undefined ? { oldPrice: body.oldPrice ?? null } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: nullify(body.imageUrl) } : {}),
          ...(body.stock !== undefined ? { stock: body.stock } : {}),
          ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });

      if (body.items) {
        await tx.packItem.deleteMany({ where: { packId: id } });
        await tx.packItem.createMany({
          data: mergePackItems(body.items).map((item) => ({ ...item, packId: id })),
        });
      }

      return tx.pack.findUniqueOrThrow({ where: { id }, include: packInclude });
    });

    res.json({ data: serializePack(pack) });
  }),
);

adminRouter.delete(
  '/packs/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const ordered = await prisma.orderItem.count({ where: { packId: id } });
    if (ordered > 0) {
      await prisma.pack.update({ where: { id }, data: { isActive: false, stock: 0 } });
      res.json({ data: { message: 'Pack déjà commandé : désactivé et mis hors stock' } });
      return;
    }
    await prisma.pack.delete({ where: { id } });
    res.json({ data: { message: 'Pack supprimé' } });
  }),
);

/** Déclinaisons à choisir pour composer un pack. */
adminRouter.get(
  '/variants',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const variants = await prisma.productVariant.findMany({
      where: search
        ? { product: { name: { contains: search, mode: 'insensitive' } } }
        : {},
      include: { product: { include: { brand: true } } },
      orderBy: [{ productId: 'asc' }, { price: 'asc' }],
      take: 200,
    });

    res.json({
      data: variants.map((v) => ({
        id: v.id,
        productName: v.product.name,
        brand: v.product.brand.name,
        label: [v.color, v.power, v.plugType].filter(Boolean).join(' · '),
        price: v.price,
        stock: v.stock,
      })),
    });
  }),
);

/* ----------------------------------------------------------------------- commandes */

adminRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        status: z.nativeEnum(OrderStatus).optional(),
        search: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { customerName: { contains: query.search, mode: 'insensitive' } },
              { customerPhone: { contains: query.search } },
              { customerWilaya: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);

    res.json({
      data: orders,
      meta: {
        total,
        page: query.page,
        perPage: query.perPage,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      },
    });
  }),
);

adminRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw HttpError.notFound('Commande introuvable');
    res.json({ data: order });
  }),
);

adminRouter.patch(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);

    const existing = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw HttpError.notFound('Commande introuvable');

    // Annuler une commande remet le stock réservé en rayon (une seule fois).
    if (status === OrderStatus.annule && existing.status !== OrderStatus.annule) {
      await prisma.$transaction(async (tx) => {
        for (const item of existing.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          } else if (item.packId) {
            await tx.pack.update({
              where: { id: item.packId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
        await tx.order.update({ where: { id }, data: { status } });
      });
    } else {
      await prisma.order.update({ where: { id }, data: { status } });
    }

    const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    res.json({ data: order });
  }),
);

/* -------------------------------------------------------------- comptes du back-office */

adminRouter.get(
  '/admins',
  requireOwner,
  asyncHandler(async (_req, res) => {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true },
    });
    res.json({ data: users });
  }),
);

adminRouter.post(
  '/admins',
  requireOwner,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        name: z.string().trim().min(2).max(80),
        password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
      })
      .parse(req.body);

    const user = await prisma.adminUser.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: 'admin',
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    res.status(201).json({ data: user });
  }),
);

adminRouter.patch(
  '/admins/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = z.object({ isActive: z.boolean() }).parse(req.body);

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) throw HttpError.notFound('Compte introuvable');
    if (target.role === 'owner') throw HttpError.badRequest('Le compte propriétaire reste actif');

    const user = await prisma.adminUser.update({
      where: { id },
      data: { isActive: body.isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.json({ data: user });
  }),
);
