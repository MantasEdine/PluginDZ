import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';
import { HttpError } from '../lib/http-error';

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

/** Exige un jeton admin valide (en-tête `Authorization: Bearer ...`). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(HttpError.unauthorized());
    return;
  }
  try {
    const decoded = jwt.verify(header.slice(7), env.jwtSecret) as unknown as AdminTokenPayload;
    req.admin = decoded;
    next();
  } catch {
    next(HttpError.unauthorized('Session expirée, reconnectez-vous'));
  }
}

/** Restreint une route au seul propriétaire (gestion des comptes admin). */
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (req.admin?.role !== 'owner') {
    next(HttpError.forbidden('Réservé au propriétaire'));
    return;
  }
  next();
}
