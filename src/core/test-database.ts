import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import journal from '../../drizzle/meta/_journal.json';
import type { OpenScratchDatabase } from './backup';
import * as schema from './schema';

const migrationsFolder = path.join(__dirname, '../../drizzle');

type TestDatabase = ReturnType<typeof createTestDatabase>;

// A fresh in-memory database with every migration applied, for core tests.
export function createTestDatabase() {
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder });
  return db;
}

// A fresh in-memory database with only the first `count` migrations: an
// install at schema version `count`. migrateTo and migrateToLatest then take
// it further, as the app does at launch.
export function createTestDatabaseAt(count: number) {
  const db = drizzle(new Database(':memory:'), { schema });
  migrateTo(db, count);
  return db;
}

// A fresh in-memory database with only the migrations before `tag`, as an
// install from before that migration shipped has it.
export function createTestDatabaseBefore(tag: string) {
  return createTestDatabaseAt(schemaVersionBefore(tag));
}

// How many migrations there were before `tag`: the schema version of an app
// from before it.
export function schemaVersionBefore(tag: string) {
  const count = journal.entries.findIndex(entry => entry.tag === tag);
  if (count === -1) throw new Error(`There's no migration ${tag}.`);
  return count;
}

// Applies whichever of the first `count` migrations the database hasn't had
// yet, from a copy of the migrations folder that stops there.
export function migrateTo(db: TestDatabase, count: number) {
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
    migrate(db, { migrationsFolder: folder });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

// Applies every migration the database hasn't had yet.
export function migrateToLatest(db: TestDatabase) {
  migrate(db, { migrationsFolder });
}

// Where tests bring an older Backup file up to date before importing it: a
// database in memory, as the app opens one (src/database.ts), but with
// better-sqlite3.
export const openScratchDatabase: OpenScratchDatabase = async schemaVersion => {
  const db = createTestDatabaseAt(schemaVersion);
  return {
    db,
    bringUpToDate: async () => migrateToLatest(db),
    close: () => db.$client.close(),
  };
};

// Everything in a database as a Backup file of `formatVersion` holds it: every
// table's rows, as stored. For a database from before today's tables, which
// the tracker can't export.
export function backupFileOf(db: TestDatabase, formatVersion: number) {
  const tables = db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
  );
  const [{ count }] = db.all<{ count: number }>(
    sql`SELECT count(*) AS count FROM __drizzle_migrations`,
  );
  return JSON.stringify({
    formatVersion,
    schemaVersion: count,
    appVersion: '1.0.0',
    exportedAt: '2026-11-16T12:00:00.000Z',
    tables: Object.fromEntries(
      tables.map(({ name }) => [
        name,
        db.all(sql`SELECT * FROM ${sql.identifier(name)} ORDER BY rowid`),
      ]),
    ),
  });
}
