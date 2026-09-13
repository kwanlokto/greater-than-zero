import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import {
  exerciseEntries,
  exercises,
  sets,
  settings,
  workouts,
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

export type NewSet = {
  weight: number;
  reps: number;
};

export type WorkoutSet = {
  id: string;
  // As entered, in weightUnit.
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number;
  loggedAt: Date;
};

// An Exercise within a Workout, with its Sets in the order logged.
export type ExerciseEntry = {
  id: string;
  exercise: Exercise;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  // The phone's local calendar date the Workout started on, as YYYY-MM-DD.
  localDate: string;
  startedAt: Date;
  finishedAt: Date | null;
  entries: ExerciseEntry[];
};

export type TrackerOptions = {
  // The clock; tests pass their own.
  now?: () => Date;
};

const exerciseColumns = {
  id: exercises.id,
  name: exercises.name,
  trackingType: exercises.trackingType,
  muscleGroup: exercises.muscleGroup,
  isCustom: exercises.isCustom,
};

// YYYY-MM-DD in the phone's time zone, so a late-night session counts toward
// the day it happened.
function localDateOf(time: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}

function requireExerciseName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('An Exercise needs a name');
  return name;
}

export function createTracker(db: TrackerDatabase, { now = () => new Date() }: TrackerOptions = {}) {
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

  async function readDisplayUnit(): Promise<WeightUnit> {
    const [row] = await db.select({ displayUnit: settings.displayUnit }).from(settings);
    return row.displayUnit;
  }

  async function findWorkoutInProgress(): Promise<{ id: string } | undefined> {
    const [inProgress] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(isNull(workouts.finishedAt), isNull(workouts.deletedAt)));
    return inProgress;
  }

  async function loadWorkout(id: string): Promise<Workout | undefined> {
    const workout = await db.query.workouts.findFirst({
      where: eq(workouts.id, id),
      columns: { id: true, localDate: true, startedAt: true, finishedAt: true },
      with: {
        entries: {
          where: isNull(exerciseEntries.deletedAt),
          orderBy: asc(exerciseEntries.position),
          columns: { id: true },
          with: {
            exercise: {
              columns: { id: true, name: true, trackingType: true, muscleGroup: true, isCustom: true },
            },
            sets: {
              where: isNull(sets.deletedAt),
              orderBy: asc(sets.position),
              columns: { id: true, weight: true, weightUnit: true, reps: true, loggedAt: true },
            },
          },
        },
      },
    });
    return workout;
  }

  return {
    getDisplayUnit: readDisplayUnit,

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
      await changeCustomExercise(id, { deletedAt: now() });
    },

    async getExercise(id: string): Promise<Exercise | undefined> {
      const [exercise] = await db.select(exerciseColumns).from(exercises).where(eq(exercises.id, id));
      return exercise;
    },

    async startWorkout(): Promise<{ id: string }> {
      if (await findWorkoutInProgress()) throw new Error('A Workout is already in progress');

      const startedAt = now();
      const [started] = await db
        .insert(workouts)
        .values({ startedAt, localDate: localDateOf(startedAt) })
        .returning({ id: workouts.id });
      return started;
    },

    // Appends the Exercise after the ones already in the Workout.
    async addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<{ id: string }> {
      const [{ nextPosition }] = await db
        .select({ nextPosition: sql<number>`coalesce(max(${exerciseEntries.position}), -1) + 1` })
        .from(exerciseEntries)
        .where(eq(exerciseEntries.workoutId, workoutId));
      const [entry] = await db
        .insert(exerciseEntries)
        .values({ workoutId, exerciseId, position: nextPosition })
        .returning({ id: exerciseEntries.id });
      return entry;
    },

    // Saved the moment it's logged, after the entry's earlier Sets. The weight is
    // in the display unit the lifter sees while typing it.
    async logSet(exerciseEntryId: string, { weight, reps }: NewSet): Promise<void> {
      if (!Number.isFinite(weight)) throw new Error('A weighted Set needs a weight');
      if (!Number.isInteger(reps) || reps < 1) {
        throw new Error('A Set needs a whole number of reps, at least 1');
      }
      const [{ nextPosition }] = await db
        .select({ nextPosition: sql<number>`coalesce(max(${sets.position}), -1) + 1` })
        .from(sets)
        .where(eq(sets.exerciseEntryId, exerciseEntryId));
      await db.insert(sets).values({
        exerciseEntryId,
        position: nextPosition,
        weight,
        weightUnit: await readDisplayUnit(),
        reps,
        loggedAt: now(),
      });
    },

    async finishWorkout(id: string): Promise<void> {
      await db.update(workouts).set({ finishedAt: now() }).where(eq(workouts.id, id));
    },

    getWorkout: loadWorkout,

    // Null when no Workout is in progress.
    async getWorkoutInProgress(): Promise<Workout | null> {
      const inProgress = await findWorkoutInProgress();
      return (inProgress && (await loadWorkout(inProgress.id))) ?? null;
    },
  };
}
