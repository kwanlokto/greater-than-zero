import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { createTracker, schema } from '@/core/tracker';

// The app's one database. Migrations run in the root layout before any screen reads it.
// Change events let useTrackerQuery refresh screens.
export const database = drizzle(
  openDatabaseSync('greater-than-zero.db', { enableChangeListener: true }),
  { schema },
);

export const tracker = createTracker(database);
