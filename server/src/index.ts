import { createApp } from './app';
import { env } from './env';
import { prisma } from './prisma';

const app = createApp();

const server = app.listen(env.port, () => {
  console.info(`[plugin.dz] API démarrée sur http://localhost:${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal: string) {
  console.info(`[plugin.dz] arrêt demandé (${signal})`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
