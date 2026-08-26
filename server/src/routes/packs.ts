import { Router } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/error';
import { packInclude, serializePack } from '../lib/serialize';

export const packsRouter = Router();

/** Packs de gros disponibles. `?featured=true` pour la sélection d'accueil. */
packsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const featuredOnly = req.query.featured === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 100);

    const packs = await prisma.pack.findMany({
      where: {
        isActive: true,
        stock: { gt: 0 },
        ...(featuredOnly ? { isFeatured: true } : {}),
      },
      include: packInclude,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    res.json({ data: packs.map(serializePack) });
  }),
);

packsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const pack = await prisma.pack.findUnique({ where: { slug }, include: packInclude });
    if (!pack || !pack.isActive) throw HttpError.notFound('Pack introuvable');

    const others = await prisma.pack.findMany({
      where: { isActive: true, stock: { gt: 0 }, id: { not: pack.id } },
      include: packInclude,
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: serializePack(pack), related: others.map(serializePack) });
  }),
);
