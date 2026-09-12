import { and, eq, isNull, sql } from 'drizzle-orm';
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
  trackingTypes,
  weightUnits,
  type MuscleGroup,
  type TrackingType,
  type WeightUnit,
} from './schema';

// Drizzle over expo-sqlite in the app, over better-sqlite3 in tests.
export type TrackerDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Tracker = ReturnType<typeof createTracker>;

export type NewExercise = {
  name: string;
  trackingType: TrackingType;
  muscleGroup: MuscleGroup;
};

export type Exercise = NewExercise & {
  id: string;
  isCustom: boolean;
};

// The tracking type is fixed once an Exercise is created.
export type ExerciseChanges = Omit<NewExercise, 'trackingType'>;

export type ExerciseSearch = {
  // Text typed by the lifter: every word must appear somewhere in the name,
  // ignoring case and hyphens.
  query?: string;
  muscleGroup?: MuscleGroup;
};

const exerciseColumns = {
  id: exercises.id,
  name: exercises.name,
  trackingType: exercises.trackingType,
  muscleGroup: exercises.muscleGroup,
  isCustom: exercises.isCustom,
};

function requireExerciseName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('An Exercise needs a name');
  return name;
}

export function createTracker(db: TrackerDatabase) {
  // Built-in Exercises are shared across installs and Backup files, and hidden
  // ones keep the name history shows, so only custom Exercises still in the
  // library may change.
  async function changeCustomExercise(id: string, values: Partial<typeof exercises.$inferInsert>) {
    const changed = await db
      .update(exercises)
      .set(values)
      .where(
        and(eq(exercises.id, id), eq(exercises.isCustom, true), isNull(exercises.deletedAt)),
      )
      .returning({ id: exercises.id });
    if (changed.length === 0) {
      throw new Error('Only custom Exercises in the library can be changed');
    }
  }

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
        .select(exerciseColumns)
        .from(exercises)
        .where(
          and(
            isNull(exercises.deletedAt),
            ...words.map(word => sql`instr(${searchableName}, ${word}) > 0`),
            muscleGroup && eq(exercises.muscleGroup, muscleGroup),
          ),
        )
        .orderBy(sql`${exercises.name} COLLATE NOCASE`);
    },

    async createExercise(exercise: NewExercise): Promise<Exercise> {
      const [created] = await db
        .insert(exercises)
        .values({ ...exercise, name: requireExerciseName(exercise.name), isCustom: true })
        .returning(exerciseColumns);
      return created;
    },

    async editExercise(id: string, changes: ExerciseChanges): Promise<void> {
      await changeCustomExercise(id, {
        name: requireExerciseName(changes.name),
        muscleGroup: changes.muscleGroup,
      });
    },

    // Hidden Exercises leave the library but keep their rows for history.
    async hideExercise(id: string): Promise<void> {
      await changeCustomExercise(id, { deletedAt: new Date() });
    },

    async getExercise(id: string): Promise<Exercise | undefined> {
      const [exercise] = await db.select(exerciseColumns).from(exercises).where(eq(exercises.id, id));
      return exercise;
    },
  };
}
