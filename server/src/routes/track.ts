import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { asyncHandler } from '../middleware/error';

/**
 * Enregistrement d'une visite de page publique (audience). Endpoint public appelé par
 * le front à chaque navigation. Volontairement minimal et sans donnée personnelle :
 * `visitorId` est un identifiant anonyme tiré au sort côté navigateur — ni IP, ni email.
 * Renvoie toujours 204 : le tracking ne doit jamais perturber la navigation du client.
 */
export const trackRouter = Router();

const trackSchema = z.object({
  visitorId: z.string().trim().min(1).max(64),
  path: z.string().trim().min(1).max(300),
  referrer: z.string().trim().max(300).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
});

/** Normalise la source de trafic : utm_source, sinon domaine référent, sinon « direct ». */
function normalizeSource(source?: string | null, referrer?: string | null): string {
  if (source && source.trim()) return source.trim().toLowerCase().slice(0, 60);
  if (referrer && referrer.trim()) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      if (host) return host.toLowerCase().slice(0, 60);
    } catch {
      /* référent non parsable : on ignore */
    }
  }
  return 'direct';
}

trackRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }
    const { visitorId, path, referrer, source } = parsed.data;

    // Le back-office n'est pas de l'audience commerciale : on ne le compte pas.
    if (path.startsWith('/admin')) {
      res.status(204).end();
      return;
    }

    await prisma.visit.create({
      data: {
        visitorId,
        path: path.slice(0, 300),
        referrer: referrer ? referrer.slice(0, 300) : null,
        source: normalizeSource(source, referrer),
      },
    });

    res.status(204).end();
  }),
);
