import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { BaseSQLiteDatabase, SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

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
  // In the display unit. For a bodyweight Exercise it's the added weight: null
  // for plain bodyweight, positive for a belt or vest, negative when assisted.
  weight: number | null;
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

function requireValidSet(trackingType: TrackingType, { weight, reps }: NewSet) {
  if (weight === null) {
    if (trackingType === 'weighted') throw new Error('A weighted Set needs a weight');
  } else if (!Number.isFinite(weight)) {
    throw new Error("A Set's weight must be a number");
  } else if (weight < 0 && trackingType === 'weighted') {
    throw new Error('Only bodyweight Sets can have a negative weight');
  }
  if (!Number.isInteger(reps) || reps < 1) {
    throw new Error('A Set needs a whole number of reps, at least 1');
  }
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

  // The position after the last one in use, so a new row goes at the end.
  async function nextPosition(table: SQLiteTable, position: SQLiteColumn, where: SQL) {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${position}), -1) + 1` })
      .from(table)
      .where(where);
    return next;
  }

  async function getDisplayUnit(): Promise<WeightUnit> {
    const [row] = await db.select({ displayUnit: settings.displayUnit }).from(settings);
    return row.displayUnit;
  }

  // Synchronous, so startWorkout can check and insert without yielding.
  function idOfWorkoutInProgress(): string | undefined {
    return db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(isNull(workouts.finishedAt), isNull(workouts.deletedAt)))
      .get()?.id;
  }

  async function getWorkout(id: string): Promise<Workout | undefined> {
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
    getDisplayUnit,

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
      // Checked and inserted without awaiting in between, so two presses at the
      // same moment can't both start one.
      if (idOfWorkoutInProgress()) throw new Error('A Workout is already in progress');
      const startedAt = now();
      return db
        .insert(workouts)
        .values({ startedAt, localDate: localDateOf(startedAt) })
        .returning({ id: workouts.id })
        .get();
    },

    // Appends the Exercise after the ones already in the Workout.
    async addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<{ id: string }> {
      const position = await nextPosition(
        exerciseEntries,
        exerciseEntries.position,
        eq(exerciseEntries.workoutId, workoutId),
      );
      const [entry] = await db
        .insert(exerciseEntries)
        .values({ workoutId, exerciseId, position })
        .returning({ id: exerciseEntries.id });
      return entry;
    },

    // Saved the moment it's logged, after the entry's earlier Sets. The weight is
    // in the display unit the lifter sees while typing it.
    async logSet(exerciseEntryId: string, { weight, reps }: NewSet): Promise<void> {
      const [entry] = await db
        .select({ trackingType: exercises.trackingType })
        .from(exerciseEntries)
        .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
        .where(eq(exerciseEntries.id, exerciseEntryId));
      if (!entry) throw new Error('No such Exercise in a Workout');
      requireValidSet(entry.trackingType, { weight, reps });

      await db.insert(sets).values({
        exerciseEntryId,
        position: await nextPosition(sets, sets.position, eq(sets.exerciseEntryId, exerciseEntryId)),
        weight,
        weightUnit: await getDisplayUnit(),
        reps,
        loggedAt: now(),
      });
    },

    async finishWorkout(id: string): Promise<void> {
      const finished = await db
        .update(workouts)
        .set({ finishedAt: now() })
        .where(and(eq(workouts.id, id), isNull(workouts.finishedAt)))
        .returning({ id: workouts.id });
      if (finished.length === 0) throw new Error('That Workout is not in progress');
    },

    getWorkout,

    // Null when no Workout is in progress.
    async getWorkoutInProgress(): Promise<Workout | null> {
      const id = idOfWorkoutInProgress();
      if (id === undefined) return null;
      return (await getWorkout(id)) ?? null;
    },
  };
}
