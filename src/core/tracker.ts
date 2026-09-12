import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import { settings, type WeightUnit } from './schema';

export { weightUnits, type WeightUnit } from './schema';

// Drizzle over expo-sqlite in the app, over better-sqlite3 in tests.
export type TrackerDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Tracker = ReturnType<typeof createTracker>;

export function createTracker(db: TrackerDatabase) {
  return {
    async getDisplayUnit(): Promise<WeightUnit> {
      const [row] = await db.select({ displayUnit: settings.displayUnit }).from(settings);
      return row.displayUnit;
    },

    async setDisplayUnit(unit: WeightUnit): Promise<void> {
      await db.update(settings).set({ displayUnit: unit });
    },
  };
}
