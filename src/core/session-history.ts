// Which past sessions count, and what was done in them. Last time, the "ready
// to go heavier" hint, the Workouts to repeat, next up and progress charts all
// look back at earlier Workouts; they ask here, so the order Workouts go in
// and what a working Set is are each decided once.

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { notDeleted } from './records';
import { exerciseEntries, exercises, sets, workouts, type WeightUnit } from './schema';
import type { TrackerDatabase } from './tracker';
import { withDisplayWeight, type EnteredWeight } from './weights';
import type { LastTime, Workout, WorkoutSet } from './workouts';

// A Workout that's neither finished nor discarded. Starting, finishing and
// discarding all go by this, so a discarded Workout can never be finished.
export function inProgress(): SQL {
  return and(isNull(workouts.finishedAt), notDeleted(workouts)) as SQL;
}

// A Workout that's been finished and not deleted since: one that's recorded.
export function finished(): SQL {
  return and(isNotNull(workouts.finishedAt), notDeleted(workouts)) as SQL;
}

// Workouts go in order by date. Within a date the backfilled ones come first,
// in the order they were added, since when they happened isn't known; then
// the rest by start time. latestWorkoutFirst and cameBefore follow it too.
export const workoutOrder = [
  asc(workouts.localDate),
  desc(workouts.isBackfilled),
  asc(workouts.startedAt),
];
const latestWorkoutFirst = [
  desc(workouts.localDate),
  asc(workouts.isBackfilled),
  desc(workouts.startedAt),
];

// A Workout's place in that order. One about to start has no ID yet.
export type WorkoutPlace = Pick<Workout, 'localDate' | 'startedAt' | 'isBackfilled'> & {
  id?: string;
};

// The other Workouts that come before this one in that order. Those started at
// the same moment count too, so it doesn't hang on a millisecond.
function cameBefore(workout: WorkoutPlace) {
  const startedNoLater = lte(workouts.startedAt, workout.startedAt);
  const earlierThatDay = workout.isBackfilled
    ? and(eq(workouts.isBackfilled, true), startedNoLater)
    : or(eq(workouts.isBackfilled, true), startedNoLater);
  return or(
    lt(workouts.localDate, workout.localDate),
    and(
      eq(workouts.localDate, workout.localDate),
      earlierThatDay,
      workout.id === undefined ? undefined : ne(workouts.id, workout.id),
    ),
  );
}

// A Set that hasn't been deleted, on its own or with its Exercise. For queries
// joining Sets to their Exercise entries.
export function setStillLogged(): SQL {
  return and(notDeleted(sets), notDeleted(exerciseEntries)) as SQL;
}

// A working Set is one not marked as a warm-up: here for queries, and below
// for Sets already read.
function workingSetStillLogged() {
  return and(setStillLogged(), eq(sets.isWarmUp, false));
}

export function workingSetsOf<S extends Pick<WorkoutSet, 'isWarmUp'>>(loggedSets: S[]): S[] {
  return loggedSets.filter(set => !set.isWarmUp);
}

// A working Set of a past session, as entered.
export type SessionSet = EnteredWeight & { reps: number };

type Dependencies = {
  getDisplayUnit: () => Promise<WeightUnit>;
};

export type SessionHistory = ReturnType<typeof createSessionHistory>;

export function createSessionHistory(
  db: TrackerDatabase,
  { getDisplayUnit }: Dependencies,
) {
  return {
    // An Exercise's working Sets from the most recent finished Workout, with a
    // working Set of it, that comes before `before`: so a past or backfilled
    // Workout sees the session before it, and one where the Exercise was only
    // warmed up doesn't hide the one before that.
    async lastTime(exerciseId: string, before: WorkoutPlace): Promise<LastTime | null> {
      const workingSetOfExercise = () =>
        and(eq(exerciseEntries.exerciseId, exerciseId), workingSetStillLogged());
      const [latest] = await db
        .select({ workoutId: workouts.id, localDate: workouts.localDate })
        .from(sets)
        .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(and(workingSetOfExercise(), finished(), cameBefore(before)))
        .orderBy(...latestWorkoutFirst)
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

    // The working Sets of an Exercise's most recent session before `before`:
    // the latest finished Workout with any Set of it logged, warm-ups
    // included. So a session where it was only warmed up counts, with no
    // working Sets: it isn't one to go heavier from. Undefined when it's never
    // been done.
    async latestSessionOf(
      exerciseId: string,
      before: WorkoutPlace,
    ): Promise<SessionSet[] | undefined> {
      const ofExercise = eq(exerciseEntries.exerciseId, exerciseId);
      const setsOfIt = () =>
        db
          .select({
            workoutId: workouts.id,
            weight: sets.weight,
            weightUnit: sets.weightUnit,
            reps: sets.reps,
          })
          .from(sets)
          .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
          .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id));
      const [latest] = await setsOfIt()
        .where(and(ofExercise, setStillLogged(), finished(), cameBefore(before)))
        .orderBy(...latestWorkoutFirst)
        .limit(1);
      if (!latest) return undefined;
      return setsOfIt().where(
        and(ofExercise, workingSetStillLogged(), eq(workouts.id, latest.workoutId)),
      );
    },

    // Which of these Categories was done last: the Category of the most recent
    // finished Workout in one of them. The Workout `alsoCounting` counts as
    // finished already, so next up can be worked out before finishing it.
    // Undefined when none of them has been done.
    async lastDoneAmong(categoryIds: string[], alsoCounting?: string): Promise<string | undefined> {
      if (categoryIds.length === 0) return undefined;
      const [last] = await db
        .select({ categoryId: workouts.categoryId })
        .from(workouts)
        .where(
          and(
            inArray(workouts.categoryId, categoryIds),
            or(
              finished(),
              alsoCounting === undefined
                ? undefined
                : and(eq(workouts.id, alsoCounting), notDeleted(workouts)),
            ),
          ),
        )
        .orderBy(...latestWorkoutFirst)
        .limit(1);
      return last?.categoryId ?? undefined;
    },

    // Every finished Workout, the latest first, with its Category and the
    // Exercises still in it. For telling which Workouts are the same kind.
    async finishedWorkoutsLatestFirst(): Promise<
      { id: string; categoryId: string | null; exerciseIds: string[] }[]
    > {
      const rows = await db
        .select({
          id: workouts.id,
          categoryId: workouts.categoryId,
          exerciseId: exerciseEntries.exerciseId,
        })
        .from(workouts)
        .leftJoin(
          exerciseEntries,
          and(eq(exerciseEntries.workoutId, workouts.id), notDeleted(exerciseEntries)),
        )
        .where(finished())
        .orderBy(...latestWorkoutFirst);
      const found = new Map<string, { id: string; categoryId: string | null; exerciseIds: string[] }>();
      for (const { id, categoryId, exerciseId } of rows) {
        const workout = found.get(id) ?? { id, categoryId, exerciseIds: [] };
        if (exerciseId) workout.exerciseIds.push(exerciseId);
        found.set(id, workout);
      }
      return [...found.values()];
    },

    // The Exercises with a working Set in a finished Workout, by ID: the one
    // whose latest such Workout comes last in the order Workouts go in first,
    // then by name. Hidden ones keep their history, so they're here too.
    async exercisesDoneLatestFirst(): Promise<string[]> {
      // Each Exercise once per Workout it was done in, the latest Workouts
      // first, so its first row is its latest.
      const done = await db
        .select({ id: exercises.id })
        .from(exercises)
        .innerJoin(exerciseEntries, eq(exerciseEntries.exerciseId, exercises.id))
        .innerJoin(sets, eq(sets.exerciseEntryId, exerciseEntries.id))
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(and(workingSetStillLogged(), finished()))
        .groupBy(exercises.id, workouts.id)
        .orderBy(...latestWorkoutFirst, sql`${exercises.name} COLLATE NOCASE`);
      return [...new Set(done.map(({ id }) => id))];
    },

    // An Exercise's working Sets in finished Workouts, in the order Workouts go
    // in, each with its Workout.
    workingSetsDone(exerciseId: string) {
      return db
        .select({
          workoutId: workouts.id,
          localDate: workouts.localDate,
          weight: sets.weight,
          weightUnit: sets.weightUnit,
          reps: sets.reps,
        })
        .from(sets)
        .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(and(eq(exerciseEntries.exerciseId, exerciseId), workingSetStillLogged(), finished()))
        .orderBy(...workoutOrder);
    },
  };
}
