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
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { BaseSQLiteDatabase, SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { backupFormatVersion, readTables, type BackupFile } from './backup';
import * as schema from './schema';
import {
  exerciseEntries,
  exercises,
  plannedSets,
  rotationEntries,
  rotations,
  sets,
  settings,
  templateExercises,
  templates,
  workouts,
  type MuscleGroup,
  type TrackingType,
  type WeightUnit,
} from './schema';

export { schema };
export { backupFormatVersion, type BackupFile } from './backup';
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

// A Set a Workout started from a Template plans to do, pre-filled for the
// lifter to confirm as they do it. It isn't a logged Set until then.
export type PlannedSet = {
  id: string;
  // In weightUnit, the Target's unit, which it's shown and confirmed in; null
  // for plain bodyweight.
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number;
};

// An Exercise within a Workout, with its Sets in the order logged, then the
// Sets still planned for it, in order.
export type ExerciseEntry = {
  id: string;
  exercise: Exercise;
  notes: string;
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
  // The Template it was started from, or null when started empty.
  templateId: string | null;
  // The Rotation it counted toward: the one active when it was started from
  // one of its Templates. Null otherwise.
  rotationId: string | null;
  entries: ExerciseEntry[];
};

// The Template a Workout started from, and which of its Exercises each entry
// was done for, by entry ID (see pairWithTemplate).
type TemplatePairing = {
  template: Template;
  pairs: Map<string, TemplateExercise>;
};

// An Exercise for a Template, with a Target taken from what was done.
type NewTemplateExercise = { exerciseId: string; target: TargetValues };

// The Exercise list a Template would take to match a Workout, each one either
// already in it or new, and whether that differs from the list it has.
type TemplateUpdate = {
  templateId: string;
  templateName: string;
  // A new one names the entry it's taken from.
  exercises: ({ templateExerciseId: string } | (NewTemplateExercise & { entryId: string }))[];
  differs: boolean;
};

// Where a new Workout goes: today, unless it's backfilling an earlier date.
// Started from a Template, it's a copy of the Template's Exercises with their
// Sets planned from the Targets; otherwise it starts empty.
export type NewWorkout = {
  localDate?: string;
  templateId?: string;
};

// What was recorded on one of the phone's local calendar dates.
export type Day = {
  // As YYYY-MM-DD.
  localDate: string;
  // Its finished Workouts, in the order Workouts go in.
  workouts: Workout[];
};

// An Exercise's working Sets from the most recent finished Workout before the
// one it's asked from.
export type LastTime = {
  // The local date of the Workout they're from.
  localDate: string;
  sets: WorkoutSet[];
};

// What the lifter enters for a Target: sets × rep range @ weight, e.g.
// 3 × 8–12 @ 60 kg. The weight is kept in the unit it's entered in. For a
// bodyweight Exercise it's the added weight, as for a Set.
export type TargetValues = {
  sets: number;
  minReps: number;
  maxReps: number;
  weight: number | null;
  weightUnit: WeightUnit;
};

export type Target = TargetValues & {
  // What to show: the weight in the display unit, as for a Set.
  displayWeight: Weight | null;
};

// An Exercise in a Template, with what to aim for in it.
export type TemplateExercise = {
  id: string;
  exercise: Exercise;
  target: Target;
};

export type Template = {
  id: string;
  name: string;
  // In the order they're done.
  exercises: TemplateExercise[];
};

// Templates done in turn, e.g. Push → Pull → Legs. The active one decides
// which Template is next up.
export type Rotation = {
  id: string;
  name: string;
  isActive: boolean;
  // In the order they come up.
  entries: RotationEntry[];
};

// A Template at its place in a Rotation.
export type RotationEntry = {
  id: string;
  template: Pick<Template, 'id' | 'name'>;
};

// What finishing a Workout reports.
export type FinishSummary = {
  // The Template the Workout started from, when the Workout's Exercise list no
  // longer matches it, so the lifter can be offered to update it with
  // updateTemplateFromWorkout. Null when they match, or for a Workout started
  // empty.
  templateUpdateOffer: { templateId: string; templateName: string } | null;
  // A higher Target for each Exercise whose session beat it, each accepted
  // (acceptTargetUpdate) or declined on its own.
  targetUpdateOffers: TargetUpdateOffer[];
  // The Template to do next from the active Rotation, now this Workout is
  // done (see getNextUp).
  nextUp: Template | null;
};

// An offer to raise the Target weight of an Exercise in a Template, after a
// session that beat it.
export type TargetUpdateOffer = {
  templateExerciseId: string;
  exercise: Exercise;
  // The Target as it is.
  target: Target;
  // The proposed Target weight: the lightest working Set's, as entered.
  weight: number | null;
  weightUnit: WeightUnit;
  // For showing only.
  displayWeight: Weight | null;
};

export type BackupOptions = {
  // The version of the app exporting it, recorded in the file.
  appVersion: string;
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

// The same, for relational queries.
const exerciseQueryColumns = {
  id: true,
  name: true,
  trackingType: true,
  muscleGroup: true,
  isCustom: true,
  defaultRestSeconds: true,
} as const;

const kilogramsPerPound = 0.45359237;

// A weight in another unit, at full precision.
function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  return from === 'lb' ? weight * kilogramsPerPound : weight / kilogramsPerPound;
}

// Converts for showing only; records keep the value and unit as entered.
function displayWeightOf(
  weight: number | null,
  unit: WeightUnit,
  displayUnit: WeightUnit,
): Weight | null {
  if (weight === null) return null;
  const converted = convertWeight(weight, unit, displayUnit);
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
  const weightProblem = problemWithWeight(trackingType, weight, 'Set');
  if (weightProblem) return weightProblem;
  if (!Number.isInteger(reps) || reps < 1) return 'A Set needs a whole number of reps, at least 1';
  return undefined;
}

// Why a Target can't be set for an Exercise of this tracking type, or undefined
// when it can. Its weight follows the same rules as a Set's. The Template
// commands enforce it on Targets the lifter enters; ones taken from logged Sets
// meet it already. Screens use it to decide when to allow saving.
export function problemWithTarget(
  trackingType: TrackingType,
  { sets, minReps, maxReps, weight }: TargetValues,
): string | undefined {
  if (!Number.isInteger(sets) || sets < 1) {
    return 'A Target needs a whole number of sets, at least 1';
  }
  if (!Number.isInteger(minReps) || !Number.isInteger(maxReps) || minReps < 1) {
    return 'A rep range needs whole numbers of reps, at least 1';
  }
  if (minReps > maxReps) return "A rep range's minimum can't be more than its maximum";
  return problemWithWeight(trackingType, weight, 'Target');
}

// Sets and Targets take the same weights: a weighted Exercise needs one, and
// only a bodyweight Exercise's added weight can be negative, for assistance.
function problemWithWeight(
  trackingType: TrackingType,
  weight: number | null,
  what: 'Set' | 'Target',
): string | undefined {
  if (weight === null) {
    if (trackingType === 'weighted') return `A weighted ${what} needs a weight`;
  } else if (!Number.isFinite(weight)) {
    return `A ${what}'s weight must be a number`;
  } else if (weight < 0 && trackingType === 'weighted') {
    return `Only bodyweight ${what}s can have a negative weight`;
  }
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

// A Template comes up once in a Rotation, so next up knows where it's at.
// addTemplateToRotation enforces it; screens use it to decide which Templates
// to offer.
export function canAddToRotation(rotation: Pick<Rotation, 'entries'>, templateId: string): boolean {
  return rotation.entries.every(({ template }) => template.id !== templateId);
}

// A Workout can be added to a date before today's, to backfill a session that
// wasn't logged; today's are started as they happen. startWorkout enforces it;
// screens use it to decide whether to offer adding one.
export function canAddWorkoutOn(localDate: string, now: Date): boolean {
  return localDate < localDateOf(now);
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

// Workouts go in order by date. Within a date the backfilled ones come first,
// in the order they were added, since when they happened isn't known; then
// the rest by start time. latestWorkoutFirst and cameBefore follow it too.
const workoutOrder = [asc(workouts.localDate), desc(workouts.isBackfilled), asc(workouts.startedAt)];
const latestWorkoutFirst = [
  desc(workouts.localDate),
  asc(workouts.isBackfilled),
  desc(workouts.startedAt),
];

// A Workout's place in that order. One about to start has no ID yet.
type WorkoutPlace = Pick<Workout, 'localDate' | 'startedAt' | 'isBackfilled'> & { id?: string };

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

// A planned Set not yet confirmed or dropped, whose Exercise is still in the
// Workout. For queries joining planned Sets to their Exercise entries.
function plannedSetStillThere() {
  return and(isNull(plannedSets.deletedAt), isNull(exerciseEntries.deletedAt));
}

// A Set that hasn't been deleted, on its own or with its Exercise. For queries
// joining Sets to their Exercise entries.
function setStillLogged() {
  return and(isNull(sets.deletedAt), isNull(exerciseEntries.deletedAt));
}

// A Template that hasn't been deleted.
function templateStillThere(templateId: string) {
  return and(eq(templates.id, templateId), isNull(templates.deletedAt));
}

// The Rotation next up comes from.
function activeRotation() {
  return and(eq(rotations.isActive, true), isNull(rotations.deletedAt));
}

// A Rotation that hasn't been deleted.
function rotationStillThere(rotationId: string) {
  return and(eq(rotations.id, rotationId), isNull(rotations.deletedAt));
}

// A Template still in its Rotation: not removed, alone or with the Rotation.
function rotationEntryStillIn(rotationEntryId: string) {
  return and(eq(rotationEntries.id, rotationEntryId), isNull(rotationEntries.deletedAt));
}

// An Exercise still in its Template: not removed, alone or with the Template.
function templateExerciseStillIn(templateExerciseId: string) {
  return and(eq(templateExercises.id, templateExerciseId), isNull(templateExercises.deletedAt));
}

function requireValidSet(trackingType: TrackingType, set: SetValues) {
  const problem = problemWithSet(trackingType, set);
  if (problem) throw new Error(problem);
}

// A YYYY-MM-DD date on the calendar that canAddWorkoutOn allows.
function requireBackfillDate(localDate: string, now: Date) {
  const [year, month, day] = localDate.split('-').map(Number);
  // Anything else doesn't come back the same: a day past its month's end rolls
  // into the next month, and text that isn't a date isn't one.
  if (localDateOf(new Date(year, month - 1, day)) !== localDate) {
    throw new Error(`No such date as ${localDate}`);
  }
  if (!canAddWorkoutOn(localDate, now)) {
    throw new Error('A Workout can only be added to a past date');
  }
}

function targetColumns({ sets, minReps, maxReps, weight, weightUnit }: TargetValues) {
  return {
    targetSets: sets,
    minReps,
    maxReps,
    targetWeight: weight,
    targetWeightUnit: weightUnit,
  };
}

// Back from a Template exercise row.
function targetOf(row: typeof templateExercises.$inferSelect): TargetValues {
  return {
    sets: row.targetSets,
    minReps: row.minReps,
    maxReps: row.maxReps,
    weight: row.targetWeight,
    weightUnit: row.targetWeightUnit,
  };
}

// For comparing weights entered in either unit. Plain bodyweight, stored as
// null, is no added weight.
function kilogramsOf({ weight, weightUnit }: Weighed): number {
  return convertWeight(weight ?? 0, weightUnit, 'kg');
}

// Weights in different units closer than this, in kilograms, are the same
// weight: a Set entered in kilograms against a Target in pounds rarely converts
// exactly (135 lb is 61.235 kg, loaded as 61.25), and no plate is this small.
const sameWeightTolerance = 0.05;

type Weighed = Pick<WorkoutSet, 'weight' | 'weightUnit'>;

// Plain bodyweight, stored as null, is no added weight. Weights in one unit
// compare exactly; across units, allowing for conversion (sameWeightTolerance).
function isHeavier(weight: Weighed, than: Weighed): boolean {
  if (weight.weightUnit === than.weightUnit) return (weight.weight ?? 0) > (than.weight ?? 0);
  return kilogramsOf(weight) - kilogramsOf(than) >= sameWeightTolerance;
}

function isAtLeast(weight: Weighed, than: Weighed): boolean {
  return !isHeavier(than, weight);
}

function lightestOf(weighed: WorkoutSet[]): WorkoutSet {
  return weighed.reduce((lightestSoFar, next) =>
    kilogramsOf(next) < kilogramsOf(lightestSoFar) ? next : lightestSoFar,
  );
}

function workingSetsOf(loggedSets: WorkoutSet[]): WorkoutSet[] {
  return loggedSets.filter(set => !set.isWarmUp);
}

// Whether a session's working Sets were at least the Target's number of sets,
// every one meeting `rule`: the shape of both the Target update offer and the
// "ready to go heavier" hint.
function setsMeetTarget<S>(workingSets: S[], target: TargetValues, rule: (set: S) => boolean) {
  return workingSets.length >= target.sets && workingSets.every(rule);
}

// The Target weight a session earned: when it had at least the Target's number
// of working Sets, every one heavier than the Target weight with at least the
// rep-range minimum, it's the lightest of them, as entered. Undefined for a
// session that didn't beat the Target, which never changes it. Warm-ups don't
// count.
function raisedTargetWeight(
  target: TargetValues,
  loggedSets: WorkoutSet[],
): Pick<TargetValues, 'weight' | 'weightUnit'> | undefined {
  const working = workingSetsOf(loggedSets);
  const beatIt = setsMeetTarget(
    working,
    target,
    set => isHeavier(set, target) && set.reps >= target.minReps,
  );
  if (!beatIt) return undefined;
  const { weight, weightUnit } = lightestOf(working);
  return { weight, weightUnit };
}

// A Target taken from what was done in an Exercise: as many sets as working
// Sets logged, their lowest to highest reps, at the lightest working weight as
// it was entered. Undefined with no working Set, as a Target needs one.
function targetFromSets(loggedSets: WorkoutSet[]): TargetValues | undefined {
  const working = workingSetsOf(loggedSets);
  if (working.length === 0) return undefined;
  const reps = working.map(set => set.reps);
  const lightest = lightestOf(working);
  return {
    sets: working.length,
    minReps: Math.min(...reps),
    maxReps: Math.max(...reps),
    weight: lightest.weight,
    weightUnit: lightest.weightUnit,
  };
}

// The IDs in `order` with `id` moved to `toIndex`, counting from 0, and the
// ones in between shifted along by one. Undefined when there's no such place.
function movedTo(order: string[], id: string, toIndex: number): string[] | undefined {
  const others = order.filter(other => other !== id);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > others.length) return undefined;
  others.splice(toIndex, 0, id);
  return others;
}

function requireValidTarget(trackingType: TrackingType, target: TargetValues) {
  const problem = problemWithTarget(trackingType, target);
  if (problem) throw new Error(problem);
}

function requireExerciseName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('An Exercise needs a name');
  return name;
}

function requireTemplateName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Template needs a name');
  return name;
}

function requireRotationName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Rotation needs a name');
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
  // Synchronous, so it can run inside a transaction.
  function nextPosition(
    table: SQLiteTable,
    position: SQLiteColumn,
    where: SQL,
    tx: TrackerDatabase = db,
  ): number {
    const [{ next }] = tx
      .select({ next: sql<number>`coalesce(max(${position}), -1) + 1` })
      .from(table)
      .where(where)
      .all();
    return next;
  }

  // Positions aren't renumbered when a Set is deleted, so new Sets always go
  // after every earlier one.
  function nextSetPosition(exerciseEntryId: string, tx: TrackerDatabase = db) {
    return nextPosition(sets, sets.position, eq(sets.exerciseEntryId, exerciseEntryId), tx);
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
  function idOfWorkoutInProgress(tx: TrackerDatabase = db): string | undefined {
    return tx
      .select({ id: workouts.id })
      .from(workouts)
      .where(inProgress())
      .get()?.id;
  }

  // The active Rotation, when the Template is in it: the one a Workout started
  // from the Template counts toward. Synchronous, so it can run inside a
  // transaction.
  function idOfActiveRotationWith(templateId: string, tx: TrackerDatabase = db) {
    return tx
      .select({ id: rotations.id })
      .from(rotations)
      .innerJoin(rotationEntries, eq(rotationEntries.rotationId, rotations.id))
      .where(
        and(
          activeRotation(),
          eq(rotationEntries.templateId, templateId),
          isNull(rotationEntries.deletedAt),
        ),
      )
      .get()?.id;
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

  // Soft-deletes the Sets matching `where`, as part of a larger transaction.
  function softDeleteSets(tx: TrackerDatabase, where: SQL, deletedAt: Date) {
    tx.update(sets)
      .set({ deletedAt })
      .where(and(where, isNull(sets.deletedAt)))
      .run();
  }

  // Soft-deletes the planned Sets matching `where`, on their own or as part of
  // a larger transaction.
  function softDeletePlannedSets(tx: TrackerDatabase, where: SQL, deletedAt: Date) {
    tx.update(plannedSets)
      .set({ deletedAt })
      .where(and(where, isNull(plannedSets.deletedAt)))
      .run();
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
      const deleted = tx
        .update(workouts)
        .set({ deletedAt, restEndsAt: null })
        .where(and(eq(workouts.id, id), where))
        .returning({ id: workouts.id })
        .all();
      if (deleted.length === 0) return false;
      const entryIds = entryIdsOf(tx, id);
      softDeleteSets(tx, inArray(sets.exerciseEntryId, entryIds), deletedAt);
      softDeletePlannedSets(tx, inArray(plannedSets.exerciseEntryId, entryIds), deletedAt);
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

  // The Workouts matching `where`, in the order Workouts go in, each with its
  // Exercises and Sets in order. Deleted Workouts, removed Exercises and
  // deleted Sets are left out.
  async function findWorkouts(where: SQL | undefined): Promise<Workout[]> {
    const found = await db.query.workouts.findMany({
      where: and(where, isNull(workouts.deletedAt)),
      orderBy: workoutOrder,
      columns: {
        id: true,
        localDate: true,
        startedAt: true,
        finishedAt: true,
        isBackfilled: true,
        restEndsAt: true,
        templateId: true,
        rotationId: true,
      },
      with: {
        entries: {
          where: isNull(exerciseEntries.deletedAt),
          orderBy: asc(exerciseEntries.position),
          columns: { id: true, notes: true },
          with: {
            exercise: { columns: exerciseQueryColumns },
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
            plannedSets: {
              where: isNull(plannedSets.deletedAt),
              orderBy: asc(plannedSets.position),
              columns: { id: true, weight: true, weightUnit: true, reps: true },
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

  // The Exercise's working Sets from the most recent finished Workout, with a
  // working Set of it, that comes before this one. See getLastTime.
  async function lastTimeBefore(
    exerciseId: string,
    workout: WorkoutPlace,
  ): Promise<LastTime | null> {
    const workingSetOfExercise = () =>
      and(
        eq(exerciseEntries.exerciseId, exerciseId),
        setStillLogged(),
        eq(sets.isWarmUp, false),
      );

    const [latest] = await db
      .select({ workoutId: workouts.id, localDate: workouts.localDate })
      .from(sets)
      .innerJoin(exerciseEntries, eq(sets.exerciseEntryId, exerciseEntries.id))
      .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
      .where(and(workingSetOfExercise(), finished(), cameBefore(workout)))
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
  }

  // What starting a Template adds, for a Workout about to start: its Exercises
  // in order, each with the target number of Sets at the Target weight. Reps
  // come from the Set in the same position among last session's working Sets,
  // or the bottom of the rep range when there isn't one. An Exercise the
  // Template holds more than once counts positions on from one to the next,
  // as last session's Sets of it were logged.
  async function planFromTemplate(templateId: string, workout: WorkoutPlace) {
    const [template] = await findTemplates(eq(templates.id, templateId));
    if (!template) throw new Error('No such Template');
    const lastSets = new Map<string, WorkoutSet[]>();
    const setsPlanned = new Map<string, number>();
    const plan = [];
    for (const { id, exercise, target } of template.exercises) {
      if (!lastSets.has(exercise.id)) {
        const lastTime = await lastTimeBefore(exercise.id, workout);
        lastSets.set(exercise.id, lastTime?.sets ?? []);
      }
      const last = lastSets.get(exercise.id) ?? [];
      const first = setsPlanned.get(exercise.id) ?? 0;
      setsPlanned.set(exercise.id, first + target.sets);
      plan.push({
        exerciseId: exercise.id,
        templateExerciseId: id,
        sets: Array.from({ length: target.sets }, (_, index) => ({
          weight: target.weight,
          weightUnit: target.weightUnit,
          reps: last[first + index]?.reps ?? target.minReps,
        })),
      });
    }
    return plan;
  }

  // Adds an Exercise with its Target to a Template, at `position`, on its own or
  // as part of a larger transaction.
  function insertTemplateExercise(
    tx: TrackerDatabase,
    {
      templateId,
      exerciseId,
      position,
      target,
    }: { templateId: string; exerciseId: string; position: number; target: TargetValues },
  ): { id: string } {
    return tx
      .insert(templateExercises)
      .values({ templateId, exerciseId, position, ...targetColumns(target) })
      .returning({ id: templateExercises.id })
      .get();
  }

  // Pairs each of a Workout's entries with the Exercise in its Template it was
  // done for. An entry takes the Template exercise it was copied from, if it's
  // still in the Template. One that lost that link, by being swapped away and
  // back or removed and added again, then takes the first one left of the same
  // Exercise, so it keeps its Target. Entries added or swapped in have none.
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

  // Null for a Workout started empty, or from a Template since deleted.
  async function templatePairingOf(workout: Workout): Promise<TemplatePairing | null> {
    if (!workout.templateId) return null;
    const [template] = await findTemplates(eq(templates.id, workout.templateId));
    if (!template) return null;
    return { template, pairs: await pairWithTemplate(workout, template) };
  }

  // What the Template's Exercise list would become to match the Workout: its
  // Exercises in the Workout's order. Each is the Template exercise it's paired
  // with, keeping its Target, even if nothing was logged for it; or one new to
  // the Template (see newTemplateExercisesFrom).
  async function templateUpdateFor(
    workout: Workout,
    { template, pairs }: TemplatePairing,
  ): Promise<TemplateUpdate> {
    const newExercises = await newTemplateExercisesFrom(workout.entries);
    const exercises: TemplateUpdate['exercises'] = [];
    for (const entry of workout.entries) {
      const paired = pairs.get(entry.id);
      const newExercise = newExercises.get(entry.id);
      if (paired) exercises.push({ templateExerciseId: paired.id });
      else if (newExercise) exercises.push({ ...newExercise, entryId: entry.id });
    }
    const differs =
      exercises.length !== template.exercises.length ||
      exercises.some(
        (exercise, index) =>
          !('templateExerciseId' in exercise) ||
          exercise.templateExerciseId !== template.exercises[index].id,
      );
    return { templateId: template.id, templateName: template.name, exercises, differs };
  }

  // An offer for each Exercise whose session beat the Target it's paired with,
  // in the Workout's order (see raisedTargetWeight).
  async function targetUpdateOffersFor(
    workout: Workout,
    { pairs }: TemplatePairing,
  ): Promise<TargetUpdateOffer[]> {
    const displayUnit = await getDisplayUnit();
    return workout.entries.flatMap(entry => {
      const paired = pairs.get(entry.id);
      const raised = paired && raisedTargetWeight(paired.target, entry.sets);
      if (!paired || !raised) return [];
      return [
        {
          templateExerciseId: paired.id,
          exercise: entry.exercise,
          target: paired.target,
          ...raised,
          displayWeight: displayWeightOf(raised.weight, raised.weightUnit, displayUnit),
        },
      ];
    });
  }

  // Each entry's Exercise as a new Template exercise, with a Target taken from
  // what was done, by entry ID, in the entries' order. Left out: an entry with
  // no working Set to take a Target from, and one whose Exercise has since been
  // hidden, as Templates take theirs from the library.
  async function newTemplateExercisesFrom(
    entries: ExerciseEntry[],
  ): Promise<Map<string, NewTemplateExercise>> {
    const exerciseIds = entries.map(entry => entry.exercise.id);
    const hidden = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(inArray(exercises.id, exerciseIds), isNotNull(exercises.deletedAt)));
    const hiddenIds = new Set(hidden.map(({ id }) => id));
    const newExercises = new Map<string, NewTemplateExercise>();
    for (const entry of entries) {
      const target = targetFromSets(entry.sets);
      if (target && !hiddenIds.has(entry.exercise.id)) {
        newExercises.set(entry.id, { exerciseId: entry.exercise.id, target });
      }
    }
    return newExercises;
  }

  // The Templates matching `where`, each with its Exercises in order. Deleted
  // Templates and removed Exercises are left out.
  async function findTemplates(where: SQL | undefined): Promise<Template[]> {
    const found = await db.query.templates.findMany({
      where: and(where, isNull(templates.deletedAt)),
      orderBy: sql`${templates.name} COLLATE NOCASE`,
      columns: { id: true, name: true },
      with: {
        exercises: {
          where: isNull(templateExercises.deletedAt),
          orderBy: asc(templateExercises.position),
          with: { exercise: { columns: exerciseQueryColumns } },
        },
      },
    });
    const displayUnit = await getDisplayUnit();
    return found.map(template => ({
      id: template.id,
      name: template.name,
      exercises: template.exercises.map(row => {
        const target = targetOf(row);
        return {
          id: row.id,
          exercise: row.exercise,
          target: {
            ...target,
            displayWeight: displayWeightOf(target.weight, target.weightUnit, displayUnit),
          },
        };
      }),
    }));
  }

  // The Rotations matching `where`, by name, each with its Templates in order.
  // Deleted Rotations and removed Templates are left out.
  async function findRotations(where: SQL | undefined): Promise<Rotation[]> {
    return db.query.rotations.findMany({
      where: and(where, isNull(rotations.deletedAt)),
      orderBy: sql`${rotations.name} COLLATE NOCASE`,
      columns: { id: true, name: true, isActive: true },
      with: {
        entries: {
          where: isNull(rotationEntries.deletedAt),
          orderBy: asc(rotationEntries.position),
          columns: { id: true },
          with: { template: { columns: { id: true, name: true } } },
        },
      },
    });
  }

  // The Template to do next from the active Rotation: the one after the
  // Template of the last finished Workout that counted toward it, wrapping
  // around. The first one when there's no such Workout, or its Template has
  // since left the Rotation. Null with no active Rotation, or an empty one.
  // The Workout finishingWorkoutId counts as finished already, so
  // finishWorkout can work it out before finishing it.
  async function findNextUp(finishingWorkoutId?: string): Promise<Template | null> {
    const [active] = await findRotations(activeRotation());
    if (!active || active.entries.length === 0) return null;
    const [last] = await db
      .select({ templateId: workouts.templateId })
      .from(workouts)
      .where(
        and(
          eq(workouts.rotationId, active.id),
          or(
            finished(),
            finishingWorkoutId === undefined ? undefined : eq(workouts.id, finishingWorkoutId),
          ),
        ),
      )
      .orderBy(...latestWorkoutFirst)
      .limit(1);
    // -1 when it's not there, so the first one.
    const lastIndex = active.entries.findIndex(({ template }) => template.id === last?.templateId);
    const next = active.entries[(lastIndex + 1) % active.entries.length];
    const [template] = await findTemplates(eq(templates.id, next.template.id));
    return template ?? null;
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
    async startWorkout({ localDate, templateId }: NewWorkout = {}): Promise<{ id: string }> {
      const startedAt = now();
      if (localDate !== undefined) requireBackfillDate(localDate, startedAt);
      const workout = {
        startedAt,
        localDate: localDate ?? localDateOf(startedAt),
        isBackfilled: localDate !== undefined,
        templateId,
      };
      // Worked out before anything is saved: pre-filling looks at the sessions
      // before this one, which doesn't exist yet.
      const plan = templateId === undefined ? [] : await planFromTemplate(templateId, workout);
      // Checked and inserted without awaiting in between, so two presses at the
      // same moment can't both start one.
      return db.transaction(tx => {
        if (idOfWorkoutInProgress(tx)) throw new Error('A Workout is already in progress');
        const rotationId = templateId && idOfActiveRotationWith(templateId, tx);
        const started = tx
          .insert(workouts)
          .values({ ...workout, rotationId })
          .returning({ id: workouts.id })
          .get();
        plan.forEach(({ exerciseId, templateExerciseId, sets: planned }, position) => {
          const entry = tx
            .insert(exerciseEntries)
            .values({ workoutId: started.id, exerciseId, templateExerciseId, position })
            .returning({ id: exerciseEntries.id })
            .get();
          tx.insert(plannedSets)
            .values(
              planned.map((set, index) => ({ ...set, exerciseEntryId: entry.id, position: index })),
            )
            .run();
        });
        return started;
      });
    },

    async saveEntryNotes(exerciseEntryId: string, notes: string): Promise<void> {
      await updateEntry(exerciseEntryId, { notes });
    },

    // The new Exercise takes the old one's place in the Workout, keeping its
    // notes but not its planned Sets. Enforces canSwapExercise's rule against the saved Sets.
    async swapExercise(exerciseEntryId: string, exerciseId: string): Promise<void> {
      // All together, so a planned Set confirmed meanwhile can't land on the
      // new Exercise.
      db.transaction(tx => {
        const logged = tx
          .select({ id: sets.id })
          .from(sets)
          .where(and(eq(sets.exerciseEntryId, exerciseEntryId), isNull(sets.deletedAt)))
          .get();
        if (logged) throw new Error("An Exercise with logged Sets can't be swapped");
        const swapped = tx
          .update(exerciseEntries)
          // It's no longer the Template's Exercise.
          .set({ exerciseId, templateExerciseId: null })
          .where(and(eq(exerciseEntries.id, exerciseEntryId), isNull(exerciseEntries.deletedAt)))
          .returning({ id: exerciseEntries.id })
          .all();
        if (swapped.length === 0) throw new Error('No such Exercise in a Workout');
        // They were planned from the Target of the Exercise swapped out.
        softDeletePlannedSets(tx, eq(plannedSets.exerciseEntryId, exerciseEntryId), now());
      });
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
        softDeletePlannedSets(tx, eq(plannedSets.exerciseEntryId, exerciseEntryId), deletedAt);
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
      const position = nextPosition(
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
      await insertSet(exerciseEntryId, set, await getDisplayUnit());
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
        const taken = tx
          .update(plannedSets)
          .set({ deletedAt: loggedAt })
          .where(and(eq(plannedSets.id, plannedSetId), isNull(plannedSets.deletedAt)))
          .returning({ id: plannedSets.id })
          .all();
        if (taken.length === 0) throw new Error('No such planned Set');
        insertSetRow(tx, planned.exerciseEntryId, set, planned.weightUnit, loggedAt);
      });
      await startRest(planned.exerciseEntryId, loggedAt);
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
    async finishWorkout(id: string): Promise<FinishSummary> {
      // Worked out first, so if it fails the Workout is left unfinished, rather
      // than finished with the lifter told it wasn't.
      const workout = await getWorkout(id);
      const pairing = workout && (await templatePairingOf(workout));
      const update = pairing && (await templateUpdateFor(workout, pairing));
      const targetUpdateOffers = pairing ? await targetUpdateOffersFor(workout, pairing) : [];
      const nextUp = await findNextUp(id);
      const finishedAt = now();
      db.transaction(tx => {
        const workout = tx
          .select({ id: workouts.id })
          .from(workouts)
          .where(and(eq(workouts.id, id), inProgress()))
          .get();
        if (!workout) throw new Error('That Workout is not in progress');
        if (!hasLoggedSet(tx, id)) throw new Error('A Workout needs at least one Set to be finished');
        // Only what was done is recorded.
        const entryIds = entryIdsOf(tx, id);
        softDeletePlannedSets(tx, inArray(plannedSets.exerciseEntryId, entryIds), finishedAt);
        // Recorded, so later sessions under the Template find which Template
        // exercise each entry was done for.
        pairing?.pairs.forEach((templateExercise, entryId) => {
          tx.update(exerciseEntries)
            .set({ templateExerciseId: templateExercise.id })
            // Unless it was swapped for another Exercise meanwhile.
            .where(
              and(
                eq(exerciseEntries.id, entryId),
                eq(exerciseEntries.exerciseId, templateExercise.exercise.id),
              ),
            )
            .run();
        });
        tx.update(workouts)
          // The rest belongs to the Workout in progress, so it ends here too.
          .set({ finishedAt, restEndsAt: null })
          .where(eq(workouts.id, id))
          .run();
      });
      return {
        templateUpdateOffer: update?.differs
          ? { templateId: update.templateId, templateName: update.templateName }
          : null,
        targetUpdateOffers,
        nextUp,
      };
    },

    getWorkout,

    // "Ready to go heavier", for an Exercise in a Workout in progress started
    // from a Template: its most recent session under that Template had at
    // least the Target's number of working Sets, all at the Target weight or
    // heavier, and all with reps at or above the rep-range maximum. Compared
    // with the Target as it is now. Worked out when asked, never stored.
    async isReadyToGoHeavier(exerciseEntryId: string): Promise<boolean> {
      const [entry] = await db
        .select({ workoutId: exerciseEntries.workoutId })
        .from(exerciseEntries)
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(
          and(
            eq(exerciseEntries.id, exerciseEntryId),
            isNull(exerciseEntries.deletedAt),
            inProgress(),
          ),
        );
      const workout = entry && (await getWorkout(entry.workoutId));
      const pairing = workout && (await templatePairingOf(workout));
      const templateExercise = pairing?.pairs.get(exerciseEntryId);
      if (!workout || !pairing || !templateExercise) return false;
      const { template } = pairing;
      const { exercise, target } = templateExercise;

      // Its sessions: the Workouts from the Template with the Exercise in them,
      // or, when the Template holds it more than once, with this copy of it.
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
      // The most recent one with a Set of it logged, warm-ups included: one
      // where it was only warmed up isn't a session to go heavier from.
      const [latest] = await setsForIt()
        .where(and(doneForIt, setStillLogged(), finished(), cameBefore(workout)))
        .orderBy(...latestWorkoutFirst)
        .limit(1);
      if (!latest) return false;
      const workingSets = await setsForIt().where(
        and(
          doneForIt,
          setStillLogged(),
          eq(sets.isWarmUp, false),
          eq(workouts.id, latest.workoutId),
        ),
      );
      return setsMeetTarget(
        workingSets,
        target,
        set => isAtLeast(set, target) && set.reps >= target.maxReps,
      );
    },

    // "Last time" for an Exercise in a Workout: from the most recent finished
    // Workout before that one, so a past or backfilled Workout sees the session
    // before it. From one with a working Set of the Exercise, so a session
    // where it was only warmed up doesn't hide the one before.
    async getLastTime(exerciseEntryId: string): Promise<LastTime | null> {
      const [entry] = await db
        .select({
          exerciseId: exerciseEntries.exerciseId,
          workout: {
            id: workouts.id,
            localDate: workouts.localDate,
            startedAt: workouts.startedAt,
            isBackfilled: workouts.isBackfilled,
          },
        })
        .from(exerciseEntries)
        .innerJoin(workouts, eq(exerciseEntries.workoutId, workouts.id))
        .where(eq(exerciseEntries.id, exerciseEntryId));
      if (!entry) return null;
      return lastTimeBefore(entry.exerciseId, entry.workout);
    },

    async createTemplate(name: string): Promise<{ id: string }> {
      return db
        .insert(templates)
        .values({ name: requireTemplateName(name) })
        .returning({ id: templates.id })
        .get();
    },

    async renameTemplate(id: string, name: string): Promise<void> {
      const renamed = await db
        .update(templates)
        .set({ name: requireTemplateName(name) })
        .where(templateStillThere(id))
        .returning({ id: templates.id });
      if (renamed.length === 0) throw new Error('No such Template');
    },

    // Soft-deletes the Template with its Exercises, together, and takes it out
    // of every Rotation.
    async deleteTemplate(id: string): Promise<void> {
      const deletedAt = now();
      db.transaction(tx => {
        const deleted = tx
          .update(templates)
          .set({ deletedAt })
          .where(templateStillThere(id))
          .returning({ id: templates.id })
          .all();
        if (deleted.length === 0) throw new Error('No such Template');
        tx.update(templateExercises)
          .set({ deletedAt })
          .where(and(eq(templateExercises.templateId, id), isNull(templateExercises.deletedAt)))
          .run();
        tx.update(rotationEntries)
          .set({ deletedAt })
          .where(and(eq(rotationEntries.templateId, id), isNull(rotationEntries.deletedAt)))
          .run();
      });
    },

    // Appends the Exercise after the ones already in the Template.
    async addExerciseToTemplate(
      templateId: string,
      exerciseId: string,
      target: TargetValues,
    ): Promise<{ id: string }> {
      const [template] = await db
        .select({ id: templates.id })
        .from(templates)
        .where(templateStillThere(templateId));
      if (!template) throw new Error('No such Template');
      // Hidden Exercises already in a Template stay; new ones come from the library.
      const [exercise] = await db
        .select({ trackingType: exercises.trackingType })
        .from(exercises)
        .where(and(eq(exercises.id, exerciseId), isNull(exercises.deletedAt)));
      if (!exercise) throw new Error('No such Exercise in the library');
      requireValidTarget(exercise.trackingType, target);
      const position = nextPosition(
        templateExercises,
        templateExercises.position,
        eq(templateExercises.templateId, templateId),
      );
      return insertTemplateExercise(db, { templateId, exerciseId, position, target });
    },

    // Checked against the Exercise's tracking type, like a new Target.
    async editTarget(templateExerciseId: string, target: TargetValues): Promise<void> {
      const [row] = await db
        .select({ trackingType: exercises.trackingType })
        .from(templateExercises)
        .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
        .where(templateExerciseStillIn(templateExerciseId));
      if (!row) throw new Error('No such Exercise in a Template');
      requireValidTarget(row.trackingType, target);
      const changed = await db
        .update(templateExercises)
        .set(targetColumns(target))
        .where(templateExerciseStillIn(templateExerciseId))
        .returning({ id: templateExercises.id });
      // Removed while its Exercise was being looked up.
      if (changed.length === 0) throw new Error('No such Exercise in a Template');
    },

    // Soft delete: the others keep their positions, so their order holds.
    async removeExerciseFromTemplate(templateExerciseId: string): Promise<void> {
      const removed = await db
        .update(templateExercises)
        .set({ deletedAt: now() })
        .where(templateExerciseStillIn(templateExerciseId))
        .returning({ id: templateExercises.id });
      if (removed.length === 0) throw new Error('No such Exercise in a Template');
    },

    // Puts the Exercise at `toIndex` among the Template's Exercises, counting
    // from 0, and shifts the ones in between along by one.
    async moveTemplateExercise(templateExerciseId: string, toIndex: number): Promise<void> {
      db.transaction(tx => {
        const moving = tx
          .select({ templateId: templateExercises.templateId })
          .from(templateExercises)
          .where(templateExerciseStillIn(templateExerciseId))
          .get();
        if (!moving) throw new Error('No such Exercise in a Template');
        const order = tx
          .select({ id: templateExercises.id })
          .from(templateExercises)
          .where(
            and(
              eq(templateExercises.templateId, moving.templateId),
              isNull(templateExercises.deletedAt),
            ),
          )
          .orderBy(asc(templateExercises.position))
          .all()
          .map(row => row.id);
        const moved = movedTo(order, templateExerciseId, toIndex);
        if (!moved) throw new Error('No such place in the Template');
        moved.forEach((id, position) => {
          tx.update(templateExercises).set({ position }).where(eq(templateExercises.id, id)).run();
        });
      });
    },

    // Every Template, by name.
    getTemplates(): Promise<Template[]> {
      return findTemplates(undefined);
    },

    // Makes the Exercise list of the Template a finished Workout started from
    // match the Workout, when the lifter accepts. Exercises the Template already
    // had keep their Targets; new ones take theirs from what was done.
    async updateTemplateFromWorkout(workoutId: string): Promise<void> {
      const [workout] = await findWorkouts(and(eq(workouts.id, workoutId), finished()));
      if (!workout) throw new Error('No such finished Workout');
      const pairing = await templatePairingOf(workout);
      if (!pairing) throw new Error('That Workout has no Template to update');
      const update = await templateUpdateFor(workout, pairing);
      const { templateId } = update;
      const deletedAt = now();
      db.transaction(tx => {
        // Checked again, as it may have been deleted since.
        const template = tx
          .select({ id: templates.id })
          .from(templates)
          .where(templateStillThere(templateId))
          .get();
        if (!template) throw new Error('That Workout has no Template to update');
        const kept = update.exercises.flatMap(exercise =>
          'templateExerciseId' in exercise ? [exercise.templateExerciseId] : [],
        );
        tx.update(templateExercises)
          .set({ deletedAt })
          .where(
            and(
              eq(templateExercises.templateId, templateId),
              isNull(templateExercises.deletedAt),
              notInArray(templateExercises.id, kept),
            ),
          )
          .run();
        update.exercises.forEach((exercise, position) => {
          if ('templateExerciseId' in exercise) {
            tx.update(templateExercises)
              .set({ position })
              // Not one removed from the Template since.
              .where(templateExerciseStillIn(exercise.templateExerciseId))
              .run();
          } else {
            const { entryId, ...newExercise } = exercise;
            const created = insertTemplateExercise(tx, { templateId, position, ...newExercise });
            // So later sessions under the Template find which one it was done for.
            tx.update(exerciseEntries)
              .set({ templateExerciseId: created.id })
              .where(eq(exerciseEntries.id, entryId))
              .run();
          }
        });
      });
    },

    // Raises the Target weight of one Exercise in the Template a finished
    // Workout started from, to what its offer proposes. The offer is worked out
    // again, so only a session that beat the Target changes it. Nothing else
    // about the Target changes.
    async acceptTargetUpdate(workoutId: string, templateExerciseId: string): Promise<void> {
      const [workout] = await findWorkouts(and(eq(workouts.id, workoutId), finished()));
      if (!workout) throw new Error('No such finished Workout');
      const pairing = await templatePairingOf(workout);
      const offers = pairing ? await targetUpdateOffersFor(workout, pairing) : [];
      const offer = offers.find(candidate => candidate.templateExerciseId === templateExerciseId);
      if (!offer) throw new Error("That session didn't beat the Target");
      const raised = await db
        .update(templateExercises)
        .set({ targetWeight: offer.weight, targetWeightUnit: offer.weightUnit })
        .where(templateExerciseStillIn(templateExerciseId))
        .returning({ id: templateExercises.id });
      if (raised.length === 0) throw new Error('No such Exercise in a Template');
    },

    // A new Template of a finished Workout's Exercises, in order, each with a
    // Target taken from what was done (see newTemplateExercisesFrom).
    async saveWorkoutAsTemplate(workoutId: string, name: string): Promise<{ id: string }> {
      const templateName = requireTemplateName(name);
      const [workout] = await findWorkouts(and(eq(workouts.id, workoutId), finished()));
      if (!workout) throw new Error('No such finished Workout');
      const exercisesDone = [...(await newTemplateExercisesFrom(workout.entries)).values()];
      return db.transaction(tx => {
        const template = tx
          .insert(templates)
          .values({ name: templateName })
          .returning({ id: templates.id })
          .get();
        exercisesDone.forEach((exercise, position) => {
          insertTemplateExercise(tx, { templateId: template.id, position, ...exercise });
        });
        return template;
      });
    },

    async getTemplate(id: string): Promise<Template | undefined> {
      const [template] = await findTemplates(eq(templates.id, id));
      return template;
    },

    async createRotation(name: string): Promise<{ id: string }> {
      return db
        .insert(rotations)
        .values({ name: requireRotationName(name) })
        .returning({ id: rotations.id })
        .get();
    },

    // Appends the Template after the ones already in the Rotation. Enforces
    // canAddToRotation's rule against the saved Rotation.
    async addTemplateToRotation(rotationId: string, templateId: string): Promise<{ id: string }> {
      // Checked and inserted together, so a double tap adds it once.
      return db.transaction(tx => {
        const rotation = tx
          .select({ id: rotations.id })
          .from(rotations)
          .where(rotationStillThere(rotationId))
          .get();
        if (!rotation) throw new Error('No such Rotation');
        const template = tx
          .select({ name: templates.name })
          .from(templates)
          .where(templateStillThere(templateId))
          .get();
        if (!template) throw new Error('No such Template');
        const already = tx
          .select({ id: rotationEntries.id })
          .from(rotationEntries)
          .where(
            and(
              eq(rotationEntries.rotationId, rotationId),
              eq(rotationEntries.templateId, templateId),
              isNull(rotationEntries.deletedAt),
            ),
          )
          .get();
        if (already) throw new Error(`${template.name} is already in that Rotation`);
        const position = nextPosition(
          rotationEntries,
          rotationEntries.position,
          eq(rotationEntries.rotationId, rotationId),
          tx,
        );
        return tx
          .insert(rotationEntries)
          .values({ rotationId, templateId, position })
          .returning({ id: rotationEntries.id })
          .get();
      });
    },

    async renameRotation(id: string, name: string): Promise<void> {
      const renamed = await db
        .update(rotations)
        .set({ name: requireRotationName(name) })
        .where(rotationStillThere(id))
        .returning({ id: rotations.id });
      if (renamed.length === 0) throw new Error('No such Rotation');
    },

    // Soft delete: the others keep their positions, so their order holds.
    async removeTemplateFromRotation(rotationEntryId: string): Promise<void> {
      const removed = await db
        .update(rotationEntries)
        .set({ deletedAt: now() })
        .where(rotationEntryStillIn(rotationEntryId))
        .returning({ id: rotationEntries.id });
      if (removed.length === 0) throw new Error('No such Template in a Rotation');
    },

    // Puts the Template at `toIndex` among the Rotation's Templates, counting
    // from 0, and shifts the ones in between along by one.
    async moveTemplateInRotation(rotationEntryId: string, toIndex: number): Promise<void> {
      db.transaction(tx => {
        const moving = tx
          .select({ rotationId: rotationEntries.rotationId })
          .from(rotationEntries)
          .where(rotationEntryStillIn(rotationEntryId))
          .get();
        if (!moving) throw new Error('No such Template in a Rotation');
        const order = tx
          .select({ id: rotationEntries.id })
          .from(rotationEntries)
          .where(
            and(
              eq(rotationEntries.rotationId, moving.rotationId),
              isNull(rotationEntries.deletedAt),
            ),
          )
          .orderBy(asc(rotationEntries.position))
          .all()
          .map(row => row.id);
        const moved = movedTo(order, rotationEntryId, toIndex);
        if (!moved) throw new Error('No such place in the Rotation');
        moved.forEach((id, position) => {
          tx.update(rotationEntries).set({ position }).where(eq(rotationEntries.id, id)).run();
        });
      });
    },

    // Soft-deletes the Rotation with its entries, together. Workouts that
    // counted toward it keep saying so.
    async deleteRotation(id: string): Promise<void> {
      const deletedAt = now();
      db.transaction(tx => {
        const deleted = tx
          .update(rotations)
          .set({ deletedAt, isActive: false })
          .where(rotationStillThere(id))
          .returning({ id: rotations.id })
          .all();
        if (deleted.length === 0) throw new Error('No such Rotation');
        tx.update(rotationEntries)
          .set({ deletedAt })
          .where(and(eq(rotationEntries.rotationId, id), isNull(rotationEntries.deletedAt)))
          .run();
      });
    },

    // Makes the Rotation the active one, the one next up comes from, in place
    // of any other. Null leaves none active.
    async setActiveRotation(id: string | null): Promise<void> {
      // Together, so there's never more than one, or none after a failure.
      db.transaction(tx => {
        tx.update(rotations).set({ isActive: false }).where(eq(rotations.isActive, true)).run();
        if (id === null) return;
        const activated = tx
          .update(rotations)
          .set({ isActive: true })
          .where(rotationStillThere(id))
          .returning({ id: rotations.id })
          .all();
        if (activated.length === 0) throw new Error('No such Rotation');
      });
    },

    // Every Rotation, by name.
    getRotations(): Promise<Rotation[]> {
      return findRotations(undefined);
    },

    async getRotation(id: string): Promise<Rotation | undefined> {
      const [rotation] = await findRotations(eq(rotations.id, id));
      return rotation;
    },

    // The Template to do next from the active Rotation (see findNextUp).
    getNextUp(): Promise<Template | null> {
      return findNextUp();
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

    // The Backup file's contents, as JSON: all the lifter's data.
    async exportBackup({ appVersion }: BackupOptions): Promise<string> {
      const backup: BackupFile = {
        formatVersion: backupFormatVersion,
        appVersion,
        exportedAt: now().toISOString(),
        // Read together, so it's the data as it was at one moment.
        tables: db.transaction(tx => readTables(tx)),
      };
      return JSON.stringify(backup);
    },

    // Null when no Workout is in progress.
    async getWorkoutInProgress(): Promise<Workout | null> {
      const id = idOfWorkoutInProgress();
      if (id === undefined) return null;
      return (await getWorkout(id)) ?? null;
    },
  };
}
