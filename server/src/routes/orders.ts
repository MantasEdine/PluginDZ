import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/error';
import { isValidWilaya } from '../lib/wilayas';
import { orderReference } from '../lib/format';
import { variantLabel } from '../lib/serialize';
import { sendOrderNotification } from '../lib/mailer';
import { orderRateLimiter, lookupRateLimiter } from '../middleware/rate-limit';

export const ordersRouter = Router();

/** Numéro algérien : 05/06/07 + 8 chiffres, avec ou sans indicatif +213. */
const phonePattern = /^(?:\+213|00213|0)(?:5|6|7)\d{8}$/;

const orderItemSchema = z
  .object({
    variantId: z.number().int().positive().optional(),
    packId: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).max(999),
  })
  .refine((item) => Boolean(item.variantId) !== Boolean(item.packId), {
    message: 'Chaque ligne doit référencer soit une déclinaison, soit un pack',
  });

const createOrderSchema = z.object({
  customerName: z.string().trim().min(3, 'Nom trop court').max(120),
  customerPhone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s.-]/g, ''))
    .refine((value) => phonePattern.test(value), 'Numéro de téléphone algérien invalide'),
  customerWilaya: z.string().trim().refine(isValidWilaya, 'Wilaya invalide'),
  customerAddress: z.string().trim().min(5, 'Adresse trop courte').max(400),
  customerNote: z.string().trim().max(500).optional(),
  items: z.array(orderItemSchema).min(1, 'Le panier est vide').max(50),
});

/**
 * Enregistre une commande.
 *
 * Deux garanties importantes :
 *  - le prix est **relu en base** puis figé dans `unitPrice` (le client ne décide
 *    jamais du prix, et l'historique reste juste quand les tarifs changent) ;
 *  - le stock est décrémenté dans la même transaction que la création.
 */
ordersRouter.post(
  '/',
  orderRateLimiter,
  asyncHandler(async (req, res) => {
    const payload = createOrderSchema.parse(req.body);

    // Fusionne les doublons éventuels du panier.
    const variantQty = new Map<number, number>();
    const packQty = new Map<number, number>();
    for (const item of payload.items) {
      if (item.variantId) {
        variantQty.set(item.variantId, (variantQty.get(item.variantId) ?? 0) + item.quantity);
      } else if (item.packId) {
        packQty.set(item.packId, (packQty.get(item.packId) ?? 0) + item.quantity);
      }
    }

    const [variants, packs] = await Promise.all([
      prisma.productVariant.findMany({
        where: { id: { in: [...variantQty.keys()] } },
        include: { product: true },
      }),
      prisma.pack.findMany({ where: { id: { in: [...packQty.keys()] } } }),
    ]);

    const lines: {
      variantId: number | null;
      packId: number | null;
      quantity: number;
      unitPrice: number;
      label: string;
    }[] = [];

    for (const [variantId, quantity] of variantQty) {
      const variant = variants.find((v) => v.id === variantId);
      if (!variant || !variant.product.isActive) {
        throw HttpError.badRequest("Un article du panier n'est plus disponible");
      }
      if (variant.stock < quantity) {
        throw HttpError.conflict(
          `Stock insuffisant pour « ${variant.product.name} » (${variant.stock} restant)`,
        );
      }
      lines.push({
        variantId,
        packId: null,
        quantity,
        unitPrice: variant.price,
        label: [variant.product.name, variantLabel(variant)].filter(Boolean).join(' — '),
      });
    }

    for (const [packId, quantity] of packQty) {
      const pack = packs.find((p) => p.id === packId);
      if (!pack || !pack.isActive) {
        throw HttpError.badRequest("Un pack du panier n'est plus disponible");
      }
      if (pack.stock < quantity) {
        throw HttpError.conflict(`Stock insuffisant pour « ${pack.name} » (${pack.stock} restant)`);
      }
      lines.push({
        variantId: null,
        packId,
        quantity,
        unitPrice: pack.price,
        label: pack.name,
      });
    }

    const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          reference: 'temp',
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          customerWilaya: payload.customerWilaya,
          customerAddress: payload.customerAddress,
          customerNote: payload.customerNote ?? null,
          total,
          items: { create: lines },
        },
      });

      const withReference = await tx.order.update({
        where: { id: created.id },
        data: { reference: orderReference(created.id) },
        include: { items: true },
      });

      for (const line of lines) {
        if (line.variantId) {
          // `stock: { gte }` : si une commande concurrente a vidé le stock entre-temps,
          // aucune ligne n'est mise à jour et la transaction est annulée.
          const updated = await tx.productVariant.updateMany({
            where: { id: line.variantId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (updated.count === 0) {
            throw HttpError.conflict(`Stock insuffisant pour « ${line.label} »`);
          }
        } else if (line.packId) {
          const updated = await tx.pack.updateMany({
            where: { id: line.packId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (updated.count === 0) {
            throw HttpError.conflict(`Stock insuffisant pour « ${line.label} »`);
          }
        }
      }

      return withReference;
    });

    // La notification ne doit jamais bloquer la réponse au client.
    void sendOrderNotification({
      reference: order.reference,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerWilaya: order.customerWilaya,
      customerAddress: order.customerAddress,
      customerNote: order.customerNote,
      total: order.total,
      items: lines.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    });

    res.status(201).json({
      data: {
        reference: order.reference,
        total: order.total,
        status: order.status,
        customerName: order.customerName,
        customerWilaya: order.customerWilaya,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          label: item.label,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    });
  }),
);

/**
 * Suivi de commande. La référence est séquentielle donc devinable : le numéro de
 * téléphone du client sert de second facteur pour consulter le détail.
 */
ordersRouter.get(
  '/lookup',
  lookupRateLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      reference: z.string().trim().min(3),
      phone: z.string().trim().min(6),
    });
    const { reference, phone } = schema.parse(req.query);
    const normalizedPhone = phone.replace(/[\s.-]/g, '');

    const order = await prisma.order.findUnique({
      where: { reference: reference.toUpperCase() },
      include: { items: true },
    });

    if (!order || order.customerPhone !== normalizedPhone) {
      throw HttpError.notFound('Aucune commande ne correspond à ces informations');
    }

    res.json({
      data: {
        reference: order.reference,
        status: order.status,
        total: order.total,
        customerName: order.customerName,
        customerWilaya: order.customerWilaya,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          label: item.label,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    });
  }),
);
