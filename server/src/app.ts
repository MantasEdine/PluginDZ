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
import { prisma } from './prisma';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
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
        callback(new Error(`Origine non autorisée : ${origin}`));
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

  app.use('/api', catalogRouter);
  app.use('/api/packs', packsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/uploads', uploadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
