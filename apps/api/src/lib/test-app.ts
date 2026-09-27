import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { openDb } from '../db/client.ts';

/** An API over a fresh in-memory database, migrated, for one test (testing.md). */
export async function testApp(): Promise<FastifyInstance> {
  return buildApp({ db: await openDb(':memory:') });
}
