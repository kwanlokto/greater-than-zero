import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
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
  // The lifter's own rest after a Set of it, in seconds; null uses the default.
  defaultRestSeconds: number | null;
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
  // When the current rest ends; the timer shows the time left until then.
  restEndsAt: Date | null;
  entries: ExerciseEntry[];
};

// What was recorded on one of the phone's local calendar dates.
export type Day = {
  // As YYYY-MM-DD.
  localDate: string;
  // Its finished Workouts, in the order they started.
  workouts: Workout[];
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
  defaultRestSeconds: exercises.defaultRestSeconds,
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
  // To one decimal place, halves away from zero, so help from an assisted
  // machine rounds the same way as added weight.
  const tenths = Math.round(Math.abs(converted) * 10) / 10;
  return { value: converted < 0 ? -tenths : tenths, unit: displayUnit };
}

function withDisplayWeight(
  set: Omit<WorkoutSet, 'displayWeight'>,
  displayUnit: WeightUnit,
): WorkoutSet {
  return { ...set, displayWeight: displayWeightOf(set.weight, set.weightUnit, displayUnit) };
}

// YYYY-MM-DD in the phone's time zone, so a late-night session counts toward
// the day it happened. Screens use it for today's date.
export function localDateOf(time: Date): string {
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

// A Workout can be finished only once a Set is logged in it, warm-ups
// included; one with nothing logged is discarded instead, so History never
// marks a day with nothing done. finishWorkout enforces it; screens use it to
// decide whether to offer Finish or Discard.
export function canFinishWorkout(workout: Pick<Workout, 'entries'>): boolean {
  return workout.entries.some(entry => entry.sets.length > 0);
}

// A Workout recorded on an earlier date than the one it was started on: added
// afterwards to backfill a session that wasn't logged at the time. It's not
// being done as it's logged, so it has no rest, and its start and finish
// times are when it was entered.
export function isBackfilled(workout: Pick<Workout, 'localDate' | 'startedAt'>): boolean {
  return workout.localDate < localDateOf(workout.startedAt);
}

// The time left to rest, in seconds, worked out from the rest's end time so
// it's right whenever it's asked, even after the app has been in the
// background. Zero once the rest is over or when none has started.
export function restSecondsLeft(restEndsAt: Date | null, now: Date): number {
  if (!restEndsAt) return 0;
  return Math.max(0, (restEndsAt.getTime() - now.getTime()) / 1000);
}

// A Workout that's neither finished nor discarded. Starting, finishing and
// discarding all go by this, so a discarded Workout can never be finished.
function inProgress() {
  return and(isNull(workouts.finishedAt), isNull(workouts.deletedAt));
}

// A Workout that's been finished and not deleted since: one that's recorded.
function finished() {
  return and(isNotNull(workouts.finishedAt), isNull(workouts.deletedAt));
}

// The other Workouts that come before this one: on an earlier date, or
// started no later the same day. By date first, so a Workout backfilled onto a
// past date counts as that day's.
function cameBefore({ id, localDate, startedAt }: Pick<Workout, 'id' | 'localDate' | 'startedAt'>) {
  return or(
    lt(workouts.localDate, localDate),
    and(eq(workouts.localDate, localDate), lte(workouts.startedAt, startedAt), ne(workouts.id, id)),
  );
}

// A Set that hasn't been deleted, on its own or with its Exercise. For queries
// joining Sets to their Exercise entries.
function setStillLogged() {
  return and(isNull(sets.deletedAt), isNull(exerciseEntries.deletedAt));
}

function requireValidSet(trackingType: TrackingType, set: SetValues) {
  const problem = problemWithSet(trackingType, set);
  if (problem) throw new Error(problem);
}

// A YYYY-MM-DD date that's on the calendar and before today's.
function requirePastDate(localDate: string, today: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  // Anything else doesn't come back the same: a day past its month's end rolls
  // into the next month, and text that isn't a date isn't one.
  if (localDateOf(new Date(year, month - 1, day)) !== localDate) {
    throw new Error(`No such date as ${localDate}`);
  }
  if (localDate >= today) throw new Error('A Workout can only be added to a past date');
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

  async function getFallbackRestSeconds(): Promise<number> {
    const [row] = await db
      .select({ defaultRestSeconds: settings.defaultRestSeconds })
      .from(settings);
    return row.defaultRestSeconds;
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

  // Adds a Set after the entry's earlier ones, logged now, and starts its rest.
  async function insertSet(
    exerciseEntryId: string,
    values: Pick<typeof sets.$inferInsert, 'weight' | 'weightUnit' | 'reps' | 'isWarmUp'>,
  ) {
    const loggedAt = now();
    await db.insert(sets).values({
      ...values,
      exerciseEntryId,
      position: await nextSetPosition(exerciseEntryId),
      loggedAt,
    });
    await startRest(exerciseEntryId, loggedAt);
  }

  // Every logged Set starts a new rest, replacing the one before, lasting the
  // Exercise's own rest length or the default from Settings.
  async function startRest(exerciseEntryId: string, loggedAt: Date) {
    const [entry] = await db
      .select({
        workoutId: exerciseEntries.workoutId,
        restSeconds: exercises.defaultRestSeconds,
        localDate: workouts.localDate,
        startedAt: workouts.startedAt,
      })
      .from(exerciseEntries)
      .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
      .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
      .where(eq(exerciseEntries.id, exerciseEntryId));
    if (isBackfilled(entry)) return;
    const restSeconds = entry.restSeconds ?? (await getFallbackRestSeconds());
    // Only during a Workout: Sets added to a finished one don't start a rest.
    await db
      .update(workouts)
      .set({ restEndsAt: new Date(loggedAt.getTime() + restSeconds * 1000) })
      .where(and(eq(workouts.id, entry.workoutId), inProgress()));
  }

  // Soft-deletes the Sets matching `where`, as part of a larger transaction.
  function softDeleteSets(tx: TrackerDatabase, where: SQL, deletedAt: Date) {
    tx.update(sets)
      .set({ deletedAt })
      .where(and(where, isNull(sets.deletedAt)))
      .run();
  }

  function hasLoggedSet(tx: TrackerDatabase, workoutId: string): boolean {
    const logged = tx
      .select({ id: sets.id })
      .from(sets)
      .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
      .where(and(eq(exerciseEntries.workoutId, workoutId), setStillLogged()))
      .get();
    return logged !== undefined;
  }

  // For a transaction that has just taken Sets from an Exercise entry: throws,
  // rolling it back, if that left the entry's Workout finished with no Set,
  // since a finished Workout keeps at least one.
  function requireFinishedWorkoutKeepsASet(tx: TrackerDatabase, exerciseEntryId: string) {
    const workout = tx
      .select({ id: workouts.id })
      .from(exerciseEntries)
      .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
      .where(and(eq(exerciseEntries.id, exerciseEntryId), finished()))
      .get();
    if (workout && !hasLoggedSet(tx, workout.id)) {
      throw new Error('A finished Workout keeps at least one Set: delete the Workout instead');
    }
  }

  // Soft-deletes the Workout with its Exercise entries and Sets, all together,
  // if it's in the given state. Returns whether it was.
  function softDeleteWorkout(id: string, state: SQL | undefined): boolean {
    const deletedAt = now();
    return db.transaction(tx => {
      const deleted = tx
        .update(workouts)
        .set({ deletedAt, restEndsAt: null })
        .where(and(eq(workouts.id, id), state))
        .returning({ id: workouts.id })
        .all();
      if (deleted.length === 0) return false;
      const entryIds = tx
        .select({ id: exerciseEntries.id })
        .from(exerciseEntries)
        .where(eq(exerciseEntries.workoutId, id));
      softDeleteSets(tx, inArray(sets.exerciseEntryId, entryIds), deletedAt);
      tx.update(exerciseEntries)
        .set({ deletedAt })
        .where(and(eq(exerciseEntries.workoutId, id), isNull(exerciseEntries.deletedAt)))
        .run();
      return true;
    });
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

  // The Workouts matching `where`, in the order they started, each with its
  // Exercises and Sets in order. Deleted Workouts, removed Exercises and
  // deleted Sets are left out.
  async function findWorkouts(where: SQL | undefined): Promise<Workout[]> {
    const found = await db.query.workouts.findMany({
      where: and(where, isNull(workouts.deletedAt)),
      orderBy: asc(workouts.startedAt),
      columns: { id: true, localDate: true, startedAt: true, finishedAt: true, restEndsAt: true },
      with: {
        entries: {
          where: isNull(exerciseEntries.deletedAt),
          orderBy: asc(exerciseEntries.position),
          columns: { id: true, notes: true },
          with: {
            exercise: {
              columns: {
                id: true,
                name: true,
                trackingType: true,
                muscleGroup: true,
                isCustom: true,
                defaultRestSeconds: true,
              },
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
    const displayUnit = await getDisplayUnit();
    return found.map(workout => ({
      ...workout,
      entries: workout.entries.map(entry => ({
        ...entry,
        sets: entry.sets.map(set => withDisplayWeight(set, displayUnit)),
      })),
    }));
  }

  async function getWorkout(id: string): Promise<Workout | undefined> {
    const [workout] = await findWorkouts(eq(workouts.id, id));
    return workout;
  }

  return {
    getDisplayUnit,

    // The rest for Exercises without their own length.
    getFallbackRestSeconds,

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

    // Any Exercise in the library, built-in ones included: a rest length is the
    // lifter's preference, not part of the Exercise. Null goes back to the default.
    async setExerciseDefaultRest(exerciseId: string, seconds: number | null): Promise<void> {
      if (seconds !== null && (!Number.isInteger(seconds) || seconds < 1)) {
        throw new Error('A rest length is a whole number of seconds, at least 1');
      }
      const changed = await db
        .update(exercises)
        .set({ defaultRestSeconds: seconds })
        .where(and(eq(exercises.id, exerciseId), isNull(exercises.deletedAt)))
        .returning({ id: exercises.id });
      if (changed.length === 0) throw new Error('No such Exercise in the library');
    },

    async getExercise(id: string): Promise<Exercise | undefined> {
      const [exercise] = await db.select(exerciseColumns).from(exercises).where(eq(exercises.id, id));
      return exercise;
    },

    // Starts a Workout now, recorded on today's date, or on an earlier
    // `localDate` to backfill a session that wasn't logged at the time.
    async startWorkout({ localDate }: { localDate?: string } = {}): Promise<{ id: string }> {
      const startedAt = now();
      const today = localDateOf(startedAt);
      if (localDate !== undefined) requirePastDate(localDate, today);
      // Checked and inserted without awaiting in between, so two presses at the
      // same moment can't both start one.
      if (idOfWorkoutInProgress()) throw new Error('A Workout is already in progress');
      return db
        .insert(workouts)
        .values({ startedAt, localDate: localDate ?? today })
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
        requireFinishedWorkoutKeepsASet(tx, exerciseEntryId);
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
      await insertSet(exerciseEntryId, {
        weight: set.weight,
        weightUnit: await getDisplayUnit(),
        reps: set.reps,
        isWarmUp: set.isWarmUp ?? false,
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
      await insertSet(exerciseEntryId, last);
    },

    // Soft delete: the others keep their positions, so their order holds.
    async deleteSet(setId: string): Promise<void> {
      db.transaction(tx => {
        const [deleted] = tx
          .update(sets)
          .set({ deletedAt: now() })
          .where(and(eq(sets.id, setId), isNull(sets.deletedAt)))
          .returning({ exerciseEntryId: sets.exerciseEntryId })
          .all();
        if (!deleted) throw new Error('No such Set');
        requireFinishedWorkoutKeepsASet(tx, deleted.exerciseEntryId);
      });
    },

    // The Workout in progress is never recorded: it doesn't reach History,
    // "last time" or charts.
    async discardWorkout(id: string): Promise<void> {
      if (!softDeleteWorkout(id, inProgress())) throw new Error('That Workout is not in progress');
    },

    // A finished Workout leaves History, "last time" and charts.
    async deleteWorkout(id: string): Promise<void> {
      if (!softDeleteWorkout(id, finished())) throw new Error('No such finished Workout');
    },

    // Moves the current rest's end by `seconds`: later when positive, earlier
    // when negative. Works even once the rest is over, to add a little more.
    async moveRestEnd(workoutId: string, seconds: number): Promise<void> {
      const moved = await db
        .update(workouts)
        .set({ restEndsAt: sql`${workouts.restEndsAt} + ${seconds * 1000}` })
        .where(and(eq(workouts.id, workoutId), inProgress(), isNotNull(workouts.restEndsAt)))
        .returning({ id: workouts.id });
      if (moved.length === 0) throw new Error('No rest has started');
    },

    // Enforces canFinishWorkout's rule against the saved Sets.
    async finishWorkout(id: string): Promise<void> {
      const finishedAt = now();
      db.transaction(tx => {
        const workout = tx
          .select({ id: workouts.id })
          .from(workouts)
          .where(and(eq(workouts.id, id), inProgress()))
          .get();
        if (!workout) throw new Error('That Workout is not in progress');
        if (!hasLoggedSet(tx, id)) throw new Error('A Workout needs at least one Set to be finished');
        tx.update(workouts)
          // The rest belongs to the Workout in progress, so it ends here too.
          .set({ finishedAt, restEndsAt: null })
          .where(eq(workouts.id, id))
          .run();
      });
    },

    getWorkout,

    // "Last time" for an Exercise in a Workout: from the most recent finished
    // Workout before that one, so a past or backfilled Workout sees the session
    // before it. From one with a working Set of the Exercise, so a session
    // where it was only warmed up doesn't hide the one before.
    async getLastTime(exerciseEntryId: string): Promise<LastTime | null> {
      const [asking] = await db
        .select({
          exerciseId: exerciseEntries.exerciseId,
          workout: { id: workouts.id, localDate: workouts.localDate, startedAt: workouts.startedAt },
        })
        .from(exerciseEntries)
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(eq(exerciseEntries.id, exerciseEntryId));
      if (!asking) return null;
      const workingSetOfExercise = () =>
        and(
          eq(exerciseEntries.exerciseId, asking.exerciseId),
          setStillLogged(),
          eq(sets.isWarmUp, false),
        );

      const [latest] = await db
        .select({ workoutId: workouts.id, localDate: workouts.localDate })
        .from(sets)
        .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(and(workingSetOfExercise(), finished(), cameBefore(asking.workout)))
        // By calendar day first, so a Workout backfilled onto a past date later
        // on still counts as that day's.
        .orderBy(desc(workouts.localDate), desc(workouts.startedAt))
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

    // The local dates in a month, given as YYYY-MM, with at least one finished
    // Workout, in order.
    async getTrainingDays(month: string): Promise<string[]> {
      const days = await db
        .selectDistinct({ localDate: workouts.localDate })
        .from(workouts)
        .where(and(finished(), like(workouts.localDate, `${month}-%`)))
        .orderBy(asc(workouts.localDate));
      return days.map(day => day.localDate);
    },

    async getDay(localDate: string): Promise<Day> {
      return {
        localDate,
        workouts: await findWorkouts(and(eq(workouts.localDate, localDate), finished())),
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
