import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import * as schema from './schema';

const migrationsFolder = path.join(__dirname, '../../drizzle');

// A fresh in-memory database with every migration applied, for core tests.
export function createTestDatabase() {
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder });
  return db;
}
