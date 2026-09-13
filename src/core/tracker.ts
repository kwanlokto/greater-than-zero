import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
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

// What the lifter enters for a Set. Each command says which unit the weight is
// in. For a bodyweight Exercise the weight is the added weight: null for plain
// bodyweight, positive for a belt or vest, negative when assisted.
export type SetValues = {
  weight: number | null;
  reps: number;
  // A working Set unless marked as a warm-up.
  isWarmUp?: boolean;
};

export type Weight = {
  value: number;
  unit: WeightUnit;
};

export type WorkoutSet = {
  id: string;
  // As entered, in weightUnit. Never rewritten when the display unit changes.
  weight: number | null;
  weightUnit: WeightUnit;
  // What to show: the weight in the display unit, to at most one decimal place.
  // Null when the Set has no weight.
  displayWeight: Weight | null;
  reps: number;
  isWarmUp: boolean;
  loggedAt: Date;
};

// An Exercise within a Workout, with its Sets in the order logged.
export type ExerciseEntry = {
  id: string;
  exercise: Exercise;
  notes: string;
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

// An Exercise's working Sets from its most recent finished Workout.
export type LastTime = {
  // The local date of the Workout they're from.
  localDate: string;
  sets: WorkoutSet[];
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

const kilogramsPerPound = 0.45359237;

// Converts for showing only; records keep the value and unit as entered.
function displayWeightOf(
  weight: number | null,
  unit: WeightUnit,
  displayUnit: WeightUnit,
): Weight | null {
  if (weight === null) return null;
  const converted =
    unit === displayUnit
      ? weight
      : unit === 'lb'
        ? weight * kilogramsPerPound
        : weight / kilogramsPerPound;
  return { value: Math.round(converted * 10) / 10, unit: displayUnit };
}

function withDisplayWeight<T extends { weight: number | null; weightUnit: WeightUnit }>(
  set: T,
  displayUnit: WeightUnit,
): T & { displayWeight: Weight | null } {
  return { ...set, displayWeight: displayWeightOf(set.weight, set.weightUnit, displayUnit) };
}

// YYYY-MM-DD in the phone's time zone, so a late-night session counts toward
// the day it happened.
function localDateOf(time: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}

// Why a Set can't be logged for an Exercise of this tracking type, or undefined
// when it can. logSet enforces it; screens use it to decide when to allow logging.
export function problemWithSet(
  trackingType: TrackingType,
  { weight, reps }: SetValues,
): string | undefined {
  if (weight === null) {
    if (trackingType === 'weighted') return 'A weighted Set needs a weight';
  } else if (!Number.isFinite(weight)) {
    return "A Set's weight must be a number";
  } else if (weight < 0 && trackingType === 'weighted') {
    return 'Only bodyweight Sets can have a negative weight';
  }
  if (!Number.isInteger(reps) || reps < 1) return 'A Set needs a whole number of reps, at least 1';
  return undefined;
}

// Swapping an Exercise in a Workout is allowed only while no Set is logged for
// it, since Sets belong to the Exercise they were done on. swapExercise
// enforces it; screens use it to decide whether to offer a swap.
export function canSwapExercise(entry: Pick<ExerciseEntry, 'sets'>): boolean {
  return entry.sets.length === 0;
}

// A Workout that's neither finished nor discarded. Starting, finishing and
// discarding all go by this, so a discarded Workout can never be finished.
function inProgress() {
  return and(isNull(workouts.finishedAt), isNull(workouts.deletedAt));
}

function requireValidSet(trackingType: TrackingType, set: SetValues) {
  const problem = problemWithSet(trackingType, set);
  if (problem) throw new Error(problem);
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

  // Positions aren't renumbered when a Set is deleted, so new Sets always go
  // after every earlier one.
  function nextSetPosition(exerciseEntryId: string) {
    return nextPosition(sets, sets.position, eq(sets.exerciseEntryId, exerciseEntryId));
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
      .where(inProgress())
      .get()?.id;
  }

  // Soft-deletes the Sets matching `where`, as part of a larger transaction.
  function softDeleteSets(tx: TrackerDatabase, where: SQL, deletedAt: Date) {
    tx.update(sets)
      .set({ deletedAt })
      .where(and(where, isNull(sets.deletedAt)))
      .run();
  }

  // Removed entries can't change.
  async function updateEntry(
    exerciseEntryId: string,
    values: Partial<typeof exerciseEntries.$inferInsert>,
  ) {
    const changed = await db
      .update(exerciseEntries)
      .set(values)
      .where(and(eq(exerciseEntries.id, exerciseEntryId), isNull(exerciseEntries.deletedAt)))
      .returning({ id: exerciseEntries.id });
    if (changed.length === 0) throw new Error('No such Exercise in a Workout');
  }

  // Deleted Sets can't change.
  async function updateSet(setId: string, values: Partial<typeof sets.$inferInsert>) {
    const changed = await db
      .update(sets)
      .set(values)
      .where(and(eq(sets.id, setId), isNull(sets.deletedAt)))
      .returning({ id: sets.id });
    if (changed.length === 0) throw new Error('No such Set');
  }

  async function trackingTypeOfEntry(exerciseEntryId: string): Promise<TrackingType> {
    const [exercise] = await db
      .select({ trackingType: exercises.trackingType })
      .from(exerciseEntries)
      .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
      .where(and(eq(exerciseEntries.id, exerciseEntryId), isNull(exerciseEntries.deletedAt)));
    if (!exercise) throw new Error('No such Exercise in a Workout');
    return exercise.trackingType;
  }

  async function trackingTypeOfSet(setId: string): Promise<TrackingType> {
    const [exercise] = await db
      .select({ trackingType: exercises.trackingType })
      .from(sets)
      .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
      .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
      .where(and(eq(sets.id, setId), isNull(sets.deletedAt)));
    if (!exercise) throw new Error('No such Set');
    return exercise.trackingType;
  }

  async function getWorkout(id: string): Promise<Workout | undefined> {
    const workout = await db.query.workouts.findFirst({
      where: and(eq(workouts.id, id), isNull(workouts.deletedAt)),
      columns: { id: true, localDate: true, startedAt: true, finishedAt: true },
      with: {
        entries: {
          where: isNull(exerciseEntries.deletedAt),
          orderBy: asc(exerciseEntries.position),
          columns: { id: true, notes: true },
          with: {
            exercise: {
              columns: { id: true, name: true, trackingType: true, muscleGroup: true, isCustom: true },
            },
            sets: {
              where: isNull(sets.deletedAt),
              orderBy: asc(sets.position),
              columns: {
                id: true,
                weight: true,
                weightUnit: true,
                reps: true,
                isWarmUp: true,
                loggedAt: true,
              },
            },
          },
        },
      },
    });
    if (!workout) return undefined;
    const displayUnit = await getDisplayUnit();
    return {
      ...workout,
      entries: workout.entries.map(entry => ({
        ...entry,
        sets: entry.sets.map(set => withDisplayWeight(set, displayUnit)),
      })),
    };
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

    async saveEntryNotes(exerciseEntryId: string, notes: string): Promise<void> {
      await updateEntry(exerciseEntryId, { notes });
    },

    // The new Exercise takes the old one's place in the Workout, keeping its
    // notes. Enforces canSwapExercise's rule against the saved Sets.
    async swapExercise(exerciseEntryId: string, exerciseId: string): Promise<void> {
      const [logged] = await db
        .select({ id: sets.id })
        .from(sets)
        .where(and(eq(sets.exerciseEntryId, exerciseEntryId), isNull(sets.deletedAt)))
        .limit(1);
      if (logged) throw new Error("An Exercise with logged Sets can't be swapped");
      await updateEntry(exerciseEntryId, { exerciseId });
    },

    // Soft-deletes the entry and its Sets together.
    async removeExerciseFromWorkout(exerciseEntryId: string): Promise<void> {
      const deletedAt = now();
      db.transaction(tx => {
        const removed = tx
          .update(exerciseEntries)
          .set({ deletedAt })
          .where(and(eq(exerciseEntries.id, exerciseEntryId), isNull(exerciseEntries.deletedAt)))
          .returning({ id: exerciseEntries.id })
          .all();
        if (removed.length === 0) throw new Error('No such Exercise in a Workout');
        softDeleteSets(tx, eq(sets.exerciseEntryId, exerciseEntryId), deletedAt);
      });
    },

    // Appends the Exercise after the ones already in the Workout.
    async addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<{ id: string }> {
      const [workout] = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(and(eq(workouts.id, workoutId), isNull(workouts.deletedAt)));
      if (!workout) throw new Error('No such Workout');
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
    async logSet(exerciseEntryId: string, set: SetValues): Promise<void> {
      requireValidSet(await trackingTypeOfEntry(exerciseEntryId), set);
      await db.insert(sets).values({
        exerciseEntryId,
        position: await nextSetPosition(exerciseEntryId),
        weight: set.weight,
        weightUnit: await getDisplayUnit(),
        reps: set.reps,
        isWarmUp: set.isWarmUp ?? false,
        loggedAt: now(),
      });
    },

    // The weight is in the unit the Set was logged in, which is the unit shown
    // while correcting it; the Set keeps that unit.
    async editSet(setId: string, set: SetValues): Promise<void> {
      requireValidSet(await trackingTypeOfSet(setId), set);
      await updateSet(setId, { weight: set.weight, reps: set.reps, isWarmUp: set.isWarmUp });
    },

    // Copies the entry's latest Set, weight unit and warm-up flag included.
    async logSameAsLastSet(exerciseEntryId: string): Promise<void> {
      const [last] = await db
        .select({
          weight: sets.weight,
          weightUnit: sets.weightUnit,
          reps: sets.reps,
          isWarmUp: sets.isWarmUp,
        })
        .from(sets)
        .where(and(eq(sets.exerciseEntryId, exerciseEntryId), isNull(sets.deletedAt)))
        .orderBy(desc(sets.position))
        .limit(1);
      if (!last) throw new Error('No Set to copy yet');
      await db.insert(sets).values({
        ...last,
        exerciseEntryId,
        position: await nextSetPosition(exerciseEntryId),
        loggedAt: now(),
      });
    },

    // Soft delete: the others keep their positions, so their order holds.
    async deleteSet(setId: string): Promise<void> {
      await updateSet(setId, { deletedAt: now() });
    },

    // Soft-deletes the Workout with its Exercises and Sets, so it's never
    // recorded: it doesn't reach History, "last time" or charts.
    async discardWorkout(id: string): Promise<void> {
      const deletedAt = now();
      db.transaction(tx => {
        const discarded = tx
          .update(workouts)
          .set({ deletedAt })
          .where(and(eq(workouts.id, id), inProgress()))
          .returning({ id: workouts.id })
          .all();
        if (discarded.length === 0) throw new Error('That Workout is not in progress');
        const entryIds = tx
          .select({ id: exerciseEntries.id })
          .from(exerciseEntries)
          .where(eq(exerciseEntries.workoutId, id));
        softDeleteSets(tx, inArray(sets.exerciseEntryId, entryIds), deletedAt);
        tx.update(exerciseEntries)
          .set({ deletedAt })
          .where(and(eq(exerciseEntries.workoutId, id), isNull(exerciseEntries.deletedAt)))
          .run();
      });
    },

    async finishWorkout(id: string): Promise<void> {
      const finished = await db
        .update(workouts)
        .set({ finishedAt: now() })
        .where(and(eq(workouts.id, id), inProgress()))
        .returning({ id: workouts.id });
      if (finished.length === 0) throw new Error('That Workout is not in progress');
    },

    getWorkout,

    // From the most recent finished Workout with a working Set of the Exercise,
    // so a session where it was only warmed up doesn't hide the one before.
    async getLastTime(exerciseId: string): Promise<LastTime | null> {
      const workingSetOfExercise = () =>
        and(
          eq(exerciseEntries.exerciseId, exerciseId),
          isNull(exerciseEntries.deletedAt),
          isNull(sets.deletedAt),
          eq(sets.isWarmUp, false),
        );

      const [latest] = await db
        .select({ workoutId: workouts.id, localDate: workouts.localDate })
        .from(sets)
        .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(
          and(workingSetOfExercise(), isNotNull(workouts.finishedAt), isNull(workouts.deletedAt)),
        )
        .orderBy(desc(workouts.startedAt))
        .limit(1);
      if (!latest) return null;

      const lastSets = await db
        .select({
          id: sets.id,
          weight: sets.weight,
          weightUnit: sets.weightUnit,
          reps: sets.reps,
          isWarmUp: sets.isWarmUp,
          loggedAt: sets.loggedAt,
        })
        .from(sets)
        .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
        .where(and(workingSetOfExercise(), eq(exerciseEntries.workoutId, latest.workoutId)))
        .orderBy(asc(exerciseEntries.position), asc(sets.position));
      const displayUnit = await getDisplayUnit();
      return {
        localDate: latest.localDate,
        sets: lastSets.map(set => withDisplayWeight(set, displayUnit)),
      };
    },

    // Null when no Workout is in progress.
    async getWorkoutInProgress(): Promise<Workout | null> {
      const id = idOfWorkoutInProgress();
      if (id === undefined) return null;
      return (await getWorkout(id)) ?? null;
    },
  };
}
