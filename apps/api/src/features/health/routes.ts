import { type FastifyInstance } from 'fastify';
import { health } from './service.ts';

export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get('/health', async () => {
    return health();
  });
}
