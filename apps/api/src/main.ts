import { mkdirSync } from 'node:fs';
import { buildApp } from './app.ts';
import { openDb } from './db/client.ts';

mkdirSync('data', { recursive: true });
const db = await openDb(process.env.DATABASE_URL ?? 'file:data/tempo.db');
const app = await buildApp({ db, logger: true });
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '127.0.0.1' });
