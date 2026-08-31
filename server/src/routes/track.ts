import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { asyncHandler } from '../middleware/error';
import { deriveAttribution } from '../lib/attribution';

/**
 * Enregistrement d'une visite de page publique (audience + attribution des campagnes).
 * Endpoint public appelé par le front à chaque navigation. Volontairement minimal et sans
 * donnée personnelle : `visitorId` est un identifiant anonyme tiré au sort côté navigateur
 * — ni IP, ni email. Renvoie toujours 204 : le tracking ne doit jamais gêner la navigation.
 */
export const trackRouter = Router();

const trackSchema = z.object({
  visitorId: z.string().trim().min(1).max(64),
  path: z.string().trim().min(1).max(300),
  referrer: z.string().trim().max(300).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
  medium: z.string().trim().max(120).optional().nullable(),
  campaign: z.string().trim().max(120).optional().nullable(),
  gclid: z.string().trim().max(200).optional().nullable(),
  fbclid: z.string().trim().max(200).optional().nullable(),
});

trackRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }
    const { visitorId, path, referrer } = parsed.data;

    // Le back-office n'est pas de l'audience commerciale : on ne le compte pas.
    if (path.startsWith('/admin')) {
      res.status(204).end();
      return;
    }

    const attribution = deriveAttribution({
      source: parsed.data.source,
      medium: parsed.data.medium,
      campaign: parsed.data.campaign,
      gclid: parsed.data.gclid,
      fbclid: parsed.data.fbclid,
      referrer,
    });

    await prisma.visit.create({
      data: {
        visitorId,
        path: path.slice(0, 300),
        referrer: referrer ? referrer.slice(0, 300) : null,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
      },
    });

    res.status(204).end();
  }),
);
