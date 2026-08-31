import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';
import { prisma } from '../prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from './error';

export interface AdminTokenPayload {
  /** Identifiant du compte admin (pas `sub` : jsonwebtoken impose une chaîne). */
  adminId: number;
  email: string;
  role: 'owner' | 'admin';
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

/**
 * Exige un jeton admin valide (en-tête `Authorization: Bearer ...`) ET un compte
 * toujours actif en base. Vérifier la base à chaque requête est indispensable :
 * désactiver un compte doit révoquer sa session immédiatement, sans attendre
 * l'expiration du jeton (jusqu'à 12 h).
 */
export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw HttpError.unauthorized();
    }

    let decoded: AdminTokenPayload;
    try {
      decoded = jwt.verify(header.slice(7), env.jwtSecret) as unknown as AdminTokenPayload;
    } catch {
      throw HttpError.unauthorized('Session expirée, reconnectez-vous');
    }

    const user = await prisma.adminUser.findUnique({ where: { id: decoded.adminId } });
    if (!user || !user.isActive) {
      // Compte supprimé ou désactivé : la session ne vaut plus rien.
      throw HttpError.unauthorized('Session révoquée, reconnectez-vous');
    }

    // On repart de l'état en base (rôle/nom à jour), pas du contenu figé du jeton.
    req.admin = { adminId: user.id, email: user.email, role: user.role, name: user.name };
    next();
  },
);

/** Restreint une route au seul propriétaire (gestion des comptes admin). */
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (req.admin?.role !== 'owner') {
    next(HttpError.forbidden('Réservé au propriétaire'));
    return;
  }
  next();
}
