import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { createTracker, schema, type OpenScratchDatabase } from '@/core/tracker';
import migrations from '../drizzle/migrations';

// A database as the app works with it. expo-sqlite leaves foreign keys off;
// they're turned on to match better-sqlite3 in tests, and so that migrations
// run the same everywhere.
function withForeignKeys(sqlite: SQLiteDatabase) {
  sqlite.execSync('PRAGMA foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

// The app's one database. Migrations run in the root layout before any screen reads it.
// Change events let useTrackerQuery refresh screens.
export const database = withForeignKeys(
  openDatabaseSync('greater-than-zero.db', { enableChangeListener: true }),
);

// Where a Backup file is brought up to date before it's imported (see
// OpenScratchDatabase): a database in memory with the first `schemaVersion`
// migrations, then the rest. On a connection of its own, as expo-sqlite would
// otherwise hand back one already open, rows and all.
const openScratchDatabase: OpenScratchDatabase = async schemaVersion => {
  const scratch = openDatabaseSync(':memory:', { useNewConnection: true });
  try {
    const db = withForeignKeys(scratch);
    const entries = migrations.journal.entries.slice(0, schemaVersion);
    await migrate(db, { ...migrations, journal: { ...migrations.journal, entries } });
    return {
      db,
      bringUpToDate: () => migrate(db, migrations),
      close: () => scratch.closeSync(),
    };
  } catch (error) {
    scratch.closeSync();
    throw error;
  }
};

export const tracker = createTracker(database, { openScratchDatabase });
