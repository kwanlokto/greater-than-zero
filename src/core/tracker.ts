import { and, asc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import {
  exercises,
  settings,
  type MuscleGroup,
  type TrackingType,
  type WeightUnit,
} from './schema';

export { schema };
export {
  muscleGroups,
  weightUnits,
  type MuscleGroup,
  type TrackingType,
  type WeightUnit,
} from './schema';

// Drizzle over expo-sqlite in the app, over better-sqlite3 in tests.
export type TrackerDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Exercise = {
  id: string;
  name: string;
  trackingType: TrackingType;
  muscleGroup: MuscleGroup;
};

export type ExerciseSearch = {
  // Text typed by the lifter: every word must appear somewhere in the name,
  // ignoring case and hyphens.
  query?: string;
  muscleGroup?: MuscleGroup;
};

export function createTracker(db: TrackerDatabase) {
  return {
    async getDisplayUnit(): Promise<WeightUnit> {
      const [row] = await db.select({ displayUnit: settings.displayUnit }).from(settings);
      return row.displayUnit;
    },

    async setDisplayUnit(unit: WeightUnit): Promise<void> {
      await db.update(settings).set({ displayUnit: unit });
    },

    async searchExercises({ query = '', muscleGroup }: ExerciseSearch): Promise<Exercise[]> {
      const words = query.toLowerCase().replace(/-/g, '').split(/\s+/).filter(Boolean);
      const searchableName = sql`replace(lower(${exercises.name}), '-', '')`;
      return db
        .select({
          id: exercises.id,
          name: exercises.name,
          trackingType: exercises.trackingType,
          muscleGroup: exercises.muscleGroup,
        })
        .from(exercises)
        .where(
          and(
            ...words.map(word => sql`instr(${searchableName}, ${word}) > 0`),
            muscleGroup && eq(exercises.muscleGroup, muscleGroup),
          ),
        )
        .orderBy(asc(exercises.name));
    },
  };
}
