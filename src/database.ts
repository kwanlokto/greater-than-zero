import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from '@/core/schema';
import { createTracker } from '@/core/tracker';

// The app's one database. Migrations run in the root layout before any screen reads it.
export const database = drizzle(openDatabaseSync('greater-than-zero.db'), { schema });

export const tracker = createTracker(database);
