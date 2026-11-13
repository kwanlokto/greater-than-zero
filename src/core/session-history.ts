// Which past sessions count, and what was done in them. Last time, the "ready
// to go heavier" hint, Target update offers, next up and progress charts all
// look back at earlier Workouts; they ask here, so the order Workouts go in,
// what a working Set is and which entry was done for which Template exercise
// are each decided once.

import { and, asc, desc, eq, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm';

import { notDeleted } from './records';
import { exerciseEntries, exercises, sets, workouts, type WeightUnit } from './schema';
import type {
  LastTime,
  Template,
  TemplateExercise,
  TrackerDatabase,
  Workout,
  WorkoutSet,
} from './tracker';
import { withDisplayWeight, type EnteredWeight } from './weights';

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

// The Template a Workout started from, and which of its Exercises each entry
// was done for, by entry ID (see pairWithTemplate).
export type TemplatePairing = {
  template: Template;
  pairs: Map<string, TemplateExercise>;
};

// A working Set of a past session, as entered.
export type SessionSet = EnteredWeight & { reps: number };

type Dependencies = {
  getDisplayUnit: () => Promise<WeightUnit>;
  // Undefined once it's deleted.
  findTemplate: (id: string) => Promise<Template | undefined>;
};

export function createSessionHistory(
  db: TrackerDatabase,
  { getDisplayUnit, findTemplate }: Dependencies,
) {
  // Pairs each of a Workout's entries with the Exercise in its Template it was
  // done for. An entry takes the Template exercise it was copied from, if it's
  // still in the Template. One that lost that link, by being swapped away and
  // back or removed and added again, then takes the first one left of the same
  // Exercise, so it keeps its Target. Entries added or swapped in have none.
  // Finishing records the pairs on the entries, which is how latestSessionFor
  // tells apart two copies of one Exercise in later sessions.
  async function pairWithTemplate(
    workout: Workout,
    template: Template,
  ): Promise<Map<string, TemplateExercise>> {
    const links = await db
      .select({ id: exerciseEntries.id, templateExerciseId: exerciseEntries.templateExerciseId })
      .from(exerciseEntries)
      .where(eq(exerciseEntries.workoutId, workout.id));
    const linkOf = new Map(links.map(link => [link.id, link.templateExerciseId]));
    const unpaired = new Map(template.exercises.map(exercise => [exercise.id, exercise]));
    const pairs = new Map<string, TemplateExercise>();
    const pair = (entryId: string, templateExercise: TemplateExercise) => {
      pairs.set(entryId, templateExercise);
      unpaired.delete(templateExercise.id);
    };
    for (const entry of workout.entries) {
      const linked = unpaired.get(linkOf.get(entry.id) ?? '');
      if (linked) pair(entry.id, linked);
    }
    for (const entry of workout.entries) {
      if (pairs.has(entry.id)) continue;
      const same = [...unpaired.values()].find(({ exercise }) => exercise.id === entry.exercise.id);
      if (same) pair(entry.id, same);
    }
    return pairs;
  }

  return {
    // Null for a Workout started empty, or from a Template since deleted.
    async pairing(workout: Workout): Promise<TemplatePairing | null> {
      if (!workout.templateId) return null;
      const template = await findTemplate(workout.templateId);
      if (!template) return null;
      return { template, pairs: await pairWithTemplate(workout, template) };
    },

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

    // The working Sets of the most recent session before `before` done for one
    // Exercise of a Template: in a Workout started from the Template, with the
    // Exercise in it or, when the Template holds the Exercise more than once,
    // with this copy of it (as finishing recorded). The most recent with any
    // Set of it logged, warm-ups included: a session where it was only warmed
    // up isn't one to go heavier from. Undefined when there's none.
    async latestSessionFor(
      template: Template,
      templateExercise: TemplateExercise,
      before: WorkoutPlace,
    ): Promise<SessionSet[] | undefined> {
      const { exercise } = templateExercise;
      const copies = template.exercises.filter(held => held.exercise.id === exercise.id);
      const doneForIt =
        copies.length > 1
          ? eq(exerciseEntries.templateExerciseId, templateExercise.id)
          : and(eq(workouts.templateId, template.id), eq(exerciseEntries.exerciseId, exercise.id));
      const setsForIt = () =>
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
      const [latest] = await setsForIt()
        .where(and(doneForIt, setStillLogged(), finished(), cameBefore(before)))
        .orderBy(...latestWorkoutFirst)
        .limit(1);
      if (!latest) return undefined;
      return setsForIt().where(
        and(doneForIt, workingSetStillLogged(), eq(workouts.id, latest.workoutId)),
      );
    },

    // The Template of the most recent finished Workout that counted toward the
    // Rotation. The Workout `alsoCounting` counts as finished already, so next
    // up can be worked out before finishing it. Undefined when there's none.
    async lastTemplateInRotation(
      rotationId: string,
      alsoCounting?: string,
    ): Promise<string | null | undefined> {
      const [last] = await db
        .select({ templateId: workouts.templateId })
        .from(workouts)
        .where(
          and(
            eq(workouts.rotationId, rotationId),
            or(finished(), alsoCounting === undefined ? undefined : eq(workouts.id, alsoCounting)),
          ),
        )
        .orderBy(...latestWorkoutFirst)
        .limit(1);
      return last?.templateId;
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
