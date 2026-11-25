// Workouts and their Sets: starting one, empty or by repeating a finished one,
// logging, correcting and deleting Sets, the rest between them, finishing, and
// backfilling or correcting past ones.

import { and, asc, desc, eq, inArray, isNotNull, like, sql, type SQL } from 'drizzle-orm';

import type { Categories, Category } from './categories';
import type { Exercise } from './exercises';
import { isLocalDate, localDateOf, relativeToToday } from './local-dates';
import { notDeleted, positionAfterLast, softDelete } from './records';
import type { Rotations } from './rotations';
import {
  exerciseEntries,
  exercises,
  plannedSets,
  sets,
  workouts,
  type TrackingType,
  type WeightUnit,
} from './schema';
import { finished, inProgress, setStillLogged, type SessionHistory } from './session-history';
import type { TrackerDatabase } from './tracker';
import { problemWithWeight, type Weight } from './weights';
import type { WorkoutReads } from './workout-reads';

// What the lifter enters for a Set. Each command says which unit the weight is
// in. For a bodyweight Exercise the weight is the added weight: null for plain
// bodyweight, positive for a belt or vest, negative when assisted.
export type SetValues = {
  weight: number | null;
  reps: number;
  // A working Set unless marked as a warm-up.
  isWarmUp?: boolean;
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

// A Set a Workout plans to do, pre-filled for the lifter to confirm as they do
// it, from what was logged in the finished Workout it repeats. It isn't a
// logged Set until then.
export type PlannedSet = {
  id: string;
  // In weightUnit, which it's shown and confirmed in: the unit of the Set it
  // repeats. Null for plain bodyweight.
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number;
  // Planned as a warm-up, when it repeats one.
  isWarmUp: boolean;
};

// An Exercise within a Workout, with its Sets in the order logged, then the
// Sets still planned for it, in order.
export type ExerciseEntry = {
  id: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  plannedSets: PlannedSet[];
};

export type Workout = {
  id: string;
  // The phone's local calendar date the Workout counts toward, as YYYY-MM-DD:
  // the date it started on, or the earlier one it was backfilled onto.
  localDate: string;
  startedAt: Date;
  finishedAt: Date | null;
  // Added afterwards onto an earlier date, to backfill a session that wasn't
  // logged at the time. It's not being done as it's logged, so it has no rest,
  // and its start and finish times are only when it was entered.
  isBackfilled: boolean;
  // When the current rest ends; the timer shows the time left until then.
  restEndsAt: Date | null;
  // The Category it's in, or null for none: one the lifter gave it, or the
  // one of the Workout it repeats.
  categoryId: string | null;
  // That Category's name as it is now, e.g. after a rename. Null with none.
  categoryName: string | null;
  entries: ExerciseEntry[];
};

// Where a new Workout goes: today, unless it's backfilling an earlier date.
// Repeating a finished Workout, it's a copy of that Workout's Exercises, in
// its Category, with the Sets logged then planned as they were done.
// Otherwise it starts empty, in a Category if one is given.
export type NewWorkout = {
  localDate?: string;
  // The Category to start an empty Workout in.
  categoryId?: string;
  // The finished Workout to repeat. On its own, and only onto today.
  repeatOf?: string;
};

// What a new Workout starts with: its Exercises in order, each with the Sets
// planned for it.
type WorkoutPlan = {
  exerciseId: string;
  sets: Omit<PlannedSet, 'id'>[];
}[];

// An Exercise entry with what the lifter sees beside it while logging.
export type EntryToLog = ExerciseEntry & {
  // The Exercise's working Sets from the most recent finished Workout before
  // this one with one in it, to beat; null when there's none. So a past or
  // backfilled Workout sees the session before it, and one where the Exercise
  // was only warmed up doesn't hide the one before that.
  lastTime: LastTime | null;
  // "Ready to go heavier": in a Workout in progress, every working Set of the
  // Exercise's most recent session before it, in any Workout, reached the top
  // of the Exercise's rep range as it is now. Worked out when asked, never
  // stored. False otherwise: after a session with no working Set of it, or
  // when it's never been done.
  readyToGoHeavier: boolean;
};

// A Workout with each entry as it's logged: what the Workout screens show.
export type WorkoutToLog = Omit<Workout, 'entries'> & { entries: EntryToLog[] };

// An Exercise's working Sets from the most recent finished Workout before the
// one it's asked from.
export type LastTime = {
  // The local date of the Workout they're from.
  localDate: string;
  sets: WorkoutSet[];
};

// What finishing a Workout reports. Nothing in it needs an answer.
export type FinishSummary = {
  // The Category to do next from the active Rotation, now this Workout is
  // done (see getNextUp).
  nextUp: Category | null;
};

// Why a Set can't be logged for an Exercise of this tracking type, or undefined
// when it can. logSet enforces it; screens use it to decide when to allow logging.
export function problemWithSet(
  trackingType: TrackingType,
  { weight, reps }: SetValues,
): string | undefined {
  const weightProblem = problemWithWeight(trackingType, weight);
  if (weightProblem) return weightProblem;
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

// A Workout can be added to a date before today's, to backfill a session that
// wasn't logged; today's are started as they happen. startWorkout enforces it;
// screens use it, with today from useToday, to decide whether to offer adding
// one.
export function canAddWorkoutOn(localDate: string, today: string): boolean {
  return relativeToToday(localDate, today) === 'past';
}

// The time left to rest, in seconds, worked out from the rest's end time so
// it's right whenever it's asked, even after the app has been in the
// background. Zero once the rest is over or when none has started.
export function restSecondsLeft(restEndsAt: Date | null, now: Date): number {
  if (!restEndsAt) return 0;
  return Math.max(0, (restEndsAt.getTime() - now.getTime()) / 1000);
}

// A planned Set not yet confirmed or dropped, whose Exercise is still in the
// Workout. For queries joining planned Sets to their Exercise entries.
function plannedSetStillThere() {
  return and(notDeleted(plannedSets), notDeleted(exerciseEntries));
}

function requireValidSet(trackingType: TrackingType, set: SetValues) {
  const problem = problemWithSet(trackingType, set);
  if (problem) throw new Error(problem);
}

// A YYYY-MM-DD date on the calendar that canAddWorkoutOn allows.
function requireBackfillDate(localDate: string, now: Date) {
  if (!isLocalDate(localDate)) throw new Error(`No such date as ${localDate}`);
  if (!canAddWorkoutOn(localDate, localDateOf(now))) {
    throw new Error('A Workout can only be added to a past date');
  }
}

type WorkoutDependencies = {
  db: TrackerDatabase;
  now: () => Date;
  history: SessionHistory;
  getDisplayUnit: () => Promise<WeightUnit>;
  getFallbackRestSeconds: () => Promise<number>;
  categories: Pick<Categories, 'requireCategory'>;
  rotations: Pick<Rotations, 'findNextUp'>;
  reads: WorkoutReads;
};

export function createWorkouts({
  db,
  now,
  history,
  getDisplayUnit,
  getFallbackRestSeconds,
  categories,
  rotations,
  reads,
}: WorkoutDependencies) {
  const { findNextUp } = rotations;
  const { findWorkout } = reads;

  // Positions aren't renumbered when a Set is deleted, so new Sets always go
  // after every earlier one.
  function nextSetPosition(exerciseEntryId: string, tx: TrackerDatabase = db) {
    return positionAfterLast(tx, sets, sets.position, eq(sets.exerciseEntryId, exerciseEntryId));
  }

  // Synchronous, so startWorkout can check and insert without yielding.
  function idOfWorkoutInProgress(tx: TrackerDatabase = db): string | undefined {
    return tx.select({ id: workouts.id }).from(workouts).where(inProgress()).get()?.id;
  }

  // Adds a Set after the entry's earlier ones, with its weight in weightUnit,
  // on its own or as part of a larger transaction. The caller starts its rest.
  function insertSetRow(
    tx: TrackerDatabase,
    exerciseEntryId: string,
    set: SetValues,
    weightUnit: WeightUnit,
    loggedAt: Date,
  ) {
    tx.insert(sets)
      .values({
        exerciseEntryId,
        position: nextSetPosition(exerciseEntryId, tx),
        weight: set.weight,
        weightUnit,
        reps: set.reps,
        isWarmUp: set.isWarmUp ?? false,
        loggedAt,
      })
      .run();
  }

  // Adds a Set after the entry's earlier ones, logged now, and starts its rest.
  async function insertSet(exerciseEntryId: string, set: SetValues, weightUnit: WeightUnit) {
    const loggedAt = now();
    insertSetRow(db, exerciseEntryId, set, weightUnit, loggedAt);
    await startRest(exerciseEntryId, loggedAt);
  }

  // Every logged Set starts a new rest, replacing the one before, lasting the
  // Exercise's own rest length or the default from Settings.
  async function startRest(exerciseEntryId: string, loggedAt: Date) {
    const [entry] = await db
      .select({
        workoutId: exerciseEntries.workoutId,
        restSeconds: exercises.defaultRestSeconds,
        isBackfilled: workouts.isBackfilled,
      })
      .from(exerciseEntries)
      .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
      .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
      .where(eq(exerciseEntries.id, exerciseEntryId));
    // A backfilled Workout isn't being done as it's logged.
    if (entry.isBackfilled) return;
    const restSeconds = entry.restSeconds ?? (await getFallbackRestSeconds());
    // Only during a Workout: Sets added to a finished one don't start a rest.
    await db
      .update(workouts)
      .set({ restEndsAt: new Date(loggedAt.getTime() + restSeconds * 1000) })
      .where(and(eq(workouts.id, entry.workoutId), inProgress()));
  }

  // The IDs of a Workout's Exercise entries, for use in a subquery.
  function entryIdsOf(tx: TrackerDatabase, workoutId: string) {
    return tx
      .select({ id: exerciseEntries.id })
      .from(exerciseEntries)
      .where(eq(exerciseEntries.workoutId, workoutId));
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
  // if it also matches `where`. Returns whether it did.
  function softDeleteWorkout(id: string, where: SQL | undefined): boolean {
    const deletedAt = now();
    return db.transaction(tx => {
      // Its rest ends with it.
      const deleted = softDelete(tx, workouts, and(eq(workouts.id, id), where), deletedAt, {
        restEndsAt: null,
      });
      return deleted.length > 0;
    });
  }

  // Deleted Sets can't change.
  async function updateSet(setId: string, values: Partial<typeof sets.$inferInsert>) {
    const changed = await db
      .update(sets)
      .set(values)
      .where(and(eq(sets.id, setId), notDeleted(sets)))
      .returning({ id: sets.id });
    if (changed.length === 0) throw new Error('No such Set');
  }

  async function trackingTypeOfEntry(exerciseEntryId: string): Promise<TrackingType> {
    const [exercise] = await db
      .select({ trackingType: exercises.trackingType })
      .from(exerciseEntries)
      .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
      .where(and(eq(exerciseEntries.id, exerciseEntryId), notDeleted(exerciseEntries)));
    if (!exercise) throw new Error('No such Exercise in a Workout');
    return exercise.trackingType;
  }

  async function trackingTypeOfSet(setId: string): Promise<TrackingType> {
    const [exercise] = await db
      .select({ trackingType: exercises.trackingType })
      .from(sets)
      .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
      .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
      .where(and(eq(sets.id, setId), notDeleted(sets)));
    if (!exercise) throw new Error('No such Set');
    return exercise.trackingType;
  }

  // The Workouts matching `where`, in the order Workouts go in, each with its
  // Exercises and Sets in order. Deleted Workouts, removed Exercises and
  // deleted Sets are left out.
  // Each entry with its Last time and hint.
  async function toLog(workout: Workout): Promise<WorkoutToLog> {
    const entries: EntryToLog[] = [];
    for (const entry of workout.entries) {
      entries.push({
        ...entry,
        lastTime: await history.lastTime(entry.exercise.id, workout),
        readyToGoHeavier: await readyToGoHeavier(workout, entry),
      });
    }
    return { ...workout, entries };
  }

  // See EntryToLog.readyToGoHeavier.
  async function readyToGoHeavier(workout: Workout, { exercise }: ExerciseEntry) {
    if (workout.finishedAt !== null) return false;
    const lastSession = await history.latestSessionOf(exercise.id, workout);
    return (
      lastSession !== undefined &&
      lastSession.length > 0 &&
      lastSession.every(set => set.reps >= exercise.maxReps)
    );
  }

  // What repeating a finished Workout starts with: its Exercises in order, each
  // logged Set planned exactly as it was done, warm-ups and units included. The
  // numbers are that Workout's, not each Exercise's latest. An Exercise with
  // nothing logged comes along with nothing planned. It stays in the Workout's
  // Category.
  async function repeatPlanOf(workoutId: string) {
    const [source] = await reads.findWorkouts(and(eq(workouts.id, workoutId), finished()));
    if (!source) throw new Error('No such finished Workout');
    const plan: WorkoutPlan = source.entries.map(entry => ({
      exerciseId: entry.exercise.id,
      sets: entry.sets.map(({ weight, weightUnit, reps, isWarmUp }) => ({
        weight,
        weightUnit,
        reps,
        isWarmUp,
      })),
    }));
    return { categoryId: source.categoryId, plan };
  }

  const commands = {
    // Starts a Workout now, recorded on today's date, or on an earlier
    // `localDate` to backfill a session that wasn't logged at the time.
    async startWorkout(start: NewWorkout = {}): Promise<{ id: string }> {
      const { localDate, repeatOf } = start;
      const startedAt = now();
      if (localDate !== undefined) requireBackfillDate(localDate, startedAt);
      if (repeatOf !== undefined && (localDate !== undefined || start.categoryId !== undefined)) {
        throw new Error('A Workout is repeated onto today, on its own');
      }
      const repeated = repeatOf === undefined ? undefined : await repeatPlanOf(repeatOf);
      const plan = repeated?.plan ?? [];
      // Checked and inserted without awaiting in between, so two presses at the
      // same moment can't both start one.
      return db.transaction(tx => {
        if (idOfWorkoutInProgress(tx)) throw new Error('A Workout is already in progress');
        // A repeat stays in the Category of the Workout it repeats.
        const categoryId = repeated
          ? repeated.categoryId
          : start.categoryId === undefined
            ? null
            : categories.requireCategory(tx, start.categoryId).id;
        const started = tx
          .insert(workouts)
          .values({
            startedAt,
            localDate: localDate ?? localDateOf(startedAt),
            isBackfilled: localDate !== undefined,
            categoryId,
          })
          .returning({ id: workouts.id })
          .get();
        plan.forEach(({ exerciseId, sets: planned }, position) => {
          const entry = tx
            .insert(exerciseEntries)
            .values({ workoutId: started.id, exerciseId, position })
            .returning({ id: exerciseEntries.id })
            .get();
          // An Exercise repeated with nothing logged for it has none.
          if (planned.length === 0) return;
          tx.insert(plannedSets)
            .values(
              planned.map((set, index) => ({ ...set, exerciseEntryId: entry.id, position: index })),
            )
            .run();
        });
        return started;
      });
    },

    // The new Exercise takes the old one's place in the Workout, keeping its
    // planned Sets: as many, with the same reps, but no weight,
    // as that was planned for the Exercise swapped out. The weight is then
    // typed in the display unit, as for any new Set. Enforces
    // canSwapExercise's rule against the saved Sets.
    async swapExercise(exerciseEntryId: string, exerciseId: string): Promise<void> {
      const displayUnit = await getDisplayUnit();
      // All together, so a planned Set confirmed meanwhile can't land on the
      // new Exercise.
      db.transaction(tx => {
        const logged = tx
          .select({ id: sets.id })
          .from(sets)
          .where(and(eq(sets.exerciseEntryId, exerciseEntryId), notDeleted(sets)))
          .get();
        if (logged) throw new Error("An Exercise with logged Sets can't be swapped");
        const swapped = tx
          .update(exerciseEntries)
          .set({ exerciseId })
          .where(and(eq(exerciseEntries.id, exerciseEntryId), notDeleted(exerciseEntries)))
          .returning({ id: exerciseEntries.id })
          .all();
        if (swapped.length === 0) throw new Error('No such Exercise in a Workout');
        tx.update(plannedSets)
          .set({ weight: null, weightUnit: displayUnit })
          .where(and(eq(plannedSets.exerciseEntryId, exerciseEntryId), notDeleted(plannedSets)))
          .run();
      });
    },

    // Soft-deletes the entry and its Sets together.
    async removeExerciseFromWorkout(exerciseEntryId: string): Promise<void> {
      db.transaction(tx => {
        const removed = softDelete(
          tx,
          exerciseEntries,
          eq(exerciseEntries.id, exerciseEntryId),
          now(),
        );
        if (removed.length === 0) throw new Error('No such Exercise in a Workout');
        requireFinishedWorkoutKeepsASet(tx, exerciseEntryId);
      });
    },

    // Appends the Exercise after the ones already in the Workout.
    async addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<{ id: string }> {
      const [workout] = await db
        .select({ id: workouts.id })
        .from(workouts)
        .where(and(eq(workouts.id, workoutId), notDeleted(workouts)));
      if (!workout) throw new Error('No such Workout');
      const position = positionAfterLast(
        db,
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
    // in `weightUnit`, the unit the lifter sees while typing it (the display
    // unit, for a new Set), and the Set keeps it.
    async logSet(exerciseEntryId: string, set: SetValues, weightUnit: WeightUnit): Promise<void> {
      requireValidSet(await trackingTypeOfEntry(exerciseEntryId), set);
      await insertSet(exerciseEntryId, set, weightUnit);
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
        .where(and(eq(sets.exerciseEntryId, exerciseEntryId), notDeleted(sets)))
        .orderBy(desc(sets.position))
        .limit(1);
      if (!last) throw new Error('No Set to copy yet');
      await insertSet(exerciseEntryId, last, last.weightUnit);
    },

    // Logs the planned Set with the numbers the lifter confirms, in the unit it
    // was planned in, and takes it off the plan. From then on it's a logged Set
    // like any other, so it starts the rest.
    async confirmPlannedSet(plannedSetId: string, set: SetValues): Promise<void> {
      const [planned] = await db
        .select({
          exerciseEntryId: plannedSets.exerciseEntryId,
          weightUnit: plannedSets.weightUnit,
          isWarmUp: plannedSets.isWarmUp,
          trackingType: exercises.trackingType,
        })
        .from(plannedSets)
        .innerJoin(exerciseEntries, eq(plannedSets.exerciseEntryId, exerciseEntries.id))
        .innerJoin(exercises, eq(exerciseEntries.exerciseId, exercises.id))
        .where(and(eq(plannedSets.id, plannedSetId), plannedSetStillThere()));
      if (!planned) throw new Error('No such planned Set');
      requireValidSet(planned.trackingType, set);
      const loggedAt = now();
      // Taken off the plan and logged together, so a double tap logs it once.
      db.transaction(tx => {
        const taken = softDelete(tx, plannedSets, eq(plannedSets.id, plannedSetId), loggedAt);
        if (taken.length === 0) throw new Error('No such planned Set');
        // A warm-up as planned, unless the lifter says otherwise.
        const confirmed = { ...set, isWarmUp: set.isWarmUp ?? planned.isWarmUp };
        insertSetRow(tx, planned.exerciseEntryId, confirmed, planned.weightUnit, loggedAt);
      });
      await startRest(planned.exerciseEntryId, loggedAt);
    },

    // Soft delete: the others keep their positions, so their order holds.
    async deleteSet(setId: string): Promise<void> {
      db.transaction(tx => {
        const [deleted] = tx
          .update(sets)
          .set({ deletedAt: now() })
          .where(and(eq(sets.id, setId), notDeleted(sets)))
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
    async finishWorkout(id: string): Promise<FinishSummary> {
      // Worked out first, so if it fails the Workout is left unfinished, rather
      // than finished with the lifter told it wasn't.
      const nextUp = await findNextUp(id);
      const finishedAt = now();
      db.transaction(tx => {
        const workout = tx
          .select({ id: workouts.id })
          .from(workouts)
          .where(and(eq(workouts.id, id), inProgress()))
          .get();
        if (!workout) throw new Error('That Workout is not in progress');
        if (!hasLoggedSet(tx, id))
          throw new Error('A Workout needs at least one Set to be finished');
        // Only what was done is recorded.
        softDelete(
          tx,
          plannedSets,
          inArray(plannedSets.exerciseEntryId, entryIdsOf(tx, id)),
          finishedAt,
        );
        tx.update(workouts)
          // The rest belongs to the Workout in progress, so it ends here too.
          .set({ finishedAt, restEndsAt: null })
          .where(eq(workouts.id, id))
          .run();
      });
      return { nextUp };
    },

    // A Workout with each entry as it's logged (see WorkoutToLog).
    async getWorkout(id: string): Promise<WorkoutToLog | undefined> {
      const workout = await findWorkout(id);
      return workout && toLog(workout);
    },

    // Null when no Workout is in progress.
    // The Workout in progress with each entry as it's logged; null when
    // there's none.
    async getWorkoutInProgress(): Promise<WorkoutToLog | null> {
      const id = idOfWorkoutInProgress();
      const workout = id === undefined ? undefined : await findWorkout(id);
      return workout ? toLog(workout) : null;
    },

    // The Workouts to offer for repeating, the most recently done first: one
    // for each kind of Workout, its latest finished one. Workouts in the same
    // Category are one kind. Those in none are one kind when they hold the
    // same Exercises, whatever the order, the weights or the reps.
    async getWorkoutsToRepeat(): Promise<Workout[]> {
      const kinds = new Set<string>();
      const latestOfEach: string[] = [];
      for (const { id, categoryId, exerciseIds } of await history.finishedWorkoutsLatestFirst()) {
        const kind = categoryId
          ? `category ${categoryId}`
          : `exercises ${[...new Set(exerciseIds)].sort().join(' ')}`;
        if (kinds.has(kind)) continue;
        kinds.add(kind);
        latestOfEach.push(id);
      }
      const found = await reads.findWorkouts(inArray(workouts.id, latestOfEach));
      // They come in the order Workouts go in, the earliest first.
      return found.reverse();
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
  };

  return { commands };
}
