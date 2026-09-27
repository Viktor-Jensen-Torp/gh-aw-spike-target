import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';

export type Db = ReturnType<typeof drizzle>;

const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Opens the database at `url` (a `file:` path, or `:memory:`) and applies every migration. */
export async function openDb(url: string): Promise<Db> {
  const db = drizzle(createClient({ url }));
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}
