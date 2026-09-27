import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db/client.ts';
import { registerErrorHandling } from './lib/errors.ts';

export interface AppOptions {
  db: Db;
  logger?: boolean;
}

/** Builds the API without listening, so tests call it through `inject`. */
export async function buildApp({
  db,
  logger = false,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  app.decorate('db', db);
  registerErrorHandling(app);
  // Features register their routes here: app.register(tasksRoutes, { prefix: "/api" }).
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}
