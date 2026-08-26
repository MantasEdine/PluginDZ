import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: int('PORT', 4000),
  databaseUrl: required('DATABASE_URL'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  publicApiUrl: (process.env.PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, ''),

  jwtSecret: required('JWT_SECRET', nodeEnv === 'production' ? undefined : 'dev-secret-local-only'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',

  owner: {
    email: process.env.OWNER_EMAIL ?? 'admin@plugin.dz',
    password: process.env.OWNER_PASSWORD ?? 'plugin2024',
    name: process.env.OWNER_NAME ?? 'Propriétaire Plugin',
  },

  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: int('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'Plugin.dz <no-reply@plugin.dz>',
    notificationTo: process.env.ORDER_NOTIFICATION_EMAIL ?? 'commandes@plugin.dz',
  },

  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  maxUploadBytes: int('MAX_UPLOAD_MB', 5) * 1024 * 1024,
};
