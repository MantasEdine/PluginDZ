import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route introuvable' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Données invalides',
      details: err.issues.map((issue) => ({
        champ: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Cette valeur existe déjà (doublon)' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Ressource introuvable' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'Élément encore référencé, suppression impossible' });
      return;
    }
  }

  console.error('[api] erreur non gérée', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

/** Enveloppe un handler async pour que les rejets partent vers errorHandler. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
