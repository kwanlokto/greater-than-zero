import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { createTracker, schema } from '@/core/tracker';

// The app's one database. Migrations run in the root layout before any screen reads it.
// Change events let useTrackerQuery refresh screens.
const sqlite = openDatabaseSync('greater-than-zero.db', { enableChangeListener: true });

// expo-sqlite leaves foreign keys off; turn them on to match better-sqlite3 in tests.
sqlite.execSync('PRAGMA foreign_keys = ON');

export const database = drizzle(sqlite, { schema });

export const tracker = createTracker(database);
