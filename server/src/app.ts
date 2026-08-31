import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { catalogRouter } from './routes/catalog';
import { packsRouter } from './routes/packs';
import { ordersRouter } from './routes/orders';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { uploadsRouter } from './routes/uploads';
import { analyticsRouter } from './routes/analytics';
import { trackRouter } from './routes/track';
import { requireAdmin } from './middleware/auth';
import { trackRateLimiter } from './middleware/rate-limit';
import { prisma } from './prisma';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Derrière le proxy d'hébergement en production : nécessaire pour que la limitation
  // de débit voie la vraie IP client (X-Forwarded-For) et non celle du proxy.
  if (env.isProduction) app.set('trust proxy', 1);
  app.use(
    helmet({
      // Les images uploadées sont servies vers le front Next.js sur un autre port.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Requêtes serveur-à-serveur (SSR Next.js, curl) : pas d'en-tête Origin.
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          callback(null, true);
          return;
        }
        // Origine non autorisée : on refuse sans en-tête CORS (le navigateur bloque
        // la lecture) plutôt que de lever une erreur qui produirait un 500.
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (!env.isProduction) app.use(morgan('dev'));

  app.use('/uploads', express.static(env.uploadDir, { maxAge: '30d', immutable: true }));

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', service: 'plugin-dz-api', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', service: 'plugin-dz-api', database: 'ko' });
    }
  });

  app.use('/api/track', trackRateLimiter, trackRouter);
  app.use('/api', catalogRouter);
  app.use('/api/packs', packsRouter);
  // Les limitations de débit propres aux commandes sont posées route par route
  // dans ordersRouter (création vs recherche), pour ne pas les cumuler.
  app.use('/api/orders', ordersRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/uploads', uploadsRouter);
  // Statistiques : protégées explicitement (montées hors de adminRouter).
  app.use('/api/admin/analytics', requireAdmin, analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
