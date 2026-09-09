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
    // Expéditeur affiché. Le domaine doit être vérifié dans Resend ; par défaut on
    // utilise l'expéditeur de test partagé de Resend (onboarding@resend.dev), qui ne
    // peut écrire qu'à l'adresse du compte Resend — parfait pour démarrer.
    from: process.env.MAIL_FROM ?? 'Plugin.dz <onboarding@resend.dev>',
    // Destinataire des notifications de commande (mettez votre email).
    notificationTo: process.env.ORDER_NOTIFICATION_EMAIL ?? 'commandes@plugin.dz',
    // Clé API Resend (https://resend.com/api-keys). À définir dans les variables
    // d'environnement de l'hébergeur, jamais en clair dans le code.
    resendApiKey: process.env.RESEND_API_KEY ?? '',
  },

  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
  maxUploadBytes: int('MAX_UPLOAD_MB', 5) * 1024 * 1024,
};
