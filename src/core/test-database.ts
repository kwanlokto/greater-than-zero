import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import journal from '../../drizzle/meta/_journal.json';
import * as schema from './schema';

const migrationsFolder = path.join(__dirname, '../../drizzle');

// A fresh in-memory database with every migration applied, for core tests.
export function createTestDatabase() {
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder });
  return db;
}

// A fresh in-memory database with only the migrations before `tag`, as an
// install from before that migration shipped has it. migrateToLatest then
// brings it up to date, as the app does at launch.
export function createTestDatabaseBefore(tag: string) {
  const count = journal.entries.findIndex(entry => entry.tag === tag);
  if (count === -1) throw new Error(`There's no migration ${tag}.`);
  const entries = journal.entries.slice(0, count);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
  try {
    fs.mkdirSync(path.join(folder, 'meta'));
    fs.writeFileSync(
      path.join(folder, 'meta', '_journal.json'),
      JSON.stringify({ ...journal, entries }),
    );
    for (const entry of entries) {
      const file = `${entry.tag}.sql`;
      fs.copyFileSync(path.join(migrationsFolder, file), path.join(folder, file));
    }
    const db = drizzle(new Database(':memory:'), { schema });
    migrate(db, { migrationsFolder: folder });
    return db;
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

// Applies every migration the database hasn't had yet.
export function migrateToLatest(db: ReturnType<typeof createTestDatabase>) {
  migrate(db, { migrationsFolder });
}
