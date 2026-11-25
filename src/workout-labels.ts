import { dayNumberOf, type PlannedSet, type Workout, type WorkoutSet } from '@/core/tracker';
import { formatLocalDate, formatLocalDateWithWeekday, formatTimeOfDay } from '@/dates';

// The mark at the start of each Set's row: W for a warm-up, and the working
// Sets numbered among themselves. Any planned Sets follow, numbered on from the
// logged ones, a planned warm-up marked W too.
export function setLabels(
  sets: Pick<WorkoutSet, 'isWarmUp'>[],
  planned: Pick<PlannedSet, 'isWarmUp'>[] = [],
): string[] {
  let working = 0;
  const label = (set: { isWarmUp: boolean }) => (set.isWarmUp ? 'W' : String(++working));
  return [...sets.map(label), ...planned.map(label)];
}

// When a Workout took place, e.g. "6:00 PM – 7:05 PM". A backfilled one's
// times are only when it was entered, so they aren't shown.
export function workoutTimes(workout: Workout): string {
  const { startedAt, finishedAt } = workout;
  if (workout.isBackfilled) return 'Added later';
  return finishedAt
    ? `${formatTimeOfDay(startedAt)} – ${formatTimeOfDay(finishedAt)}`
    : formatTimeOfDay(startedAt);
}

// "Workout for 10 Sep" while backfilling, naming the day it's being added to;
// undefined for a Workout being done now.
export function backfillTitle(workout: Workout): string | undefined {
  return workout.isBackfilled ? `Workout for ${formatLocalDate(workout.localDate)}` : undefined;
}

// What a Workout is called, wherever it's shown: its Category, e.g. "Push", or
// "Workout" when it has none.
export function workoutName(workout: Pick<Workout, 'categoryName'>): string {
  return workout.categoryName ?? 'Workout';
}

// "Bench Press, Dip": the Exercises in a Workout, in order, each once. Shown
// wherever a Workout is offered to start from, so it's never started blind.
export function workoutExercises(workout: Pick<Workout, 'entries'>): string {
  return [...new Set(workout.entries.map(entry => entry.exercise.name))].join(', ');
}

// A finished Workout in a line, under its name on Today: when it took place,
// then how much was done, e.g. "6:00 PM – 7:05 PM · 3 exercises · 9 sets". An
// Exercise done twice counts once, and warm-ups count as Sets, as they do on
// the Workout bar.
export function doneWorkoutSummary(workout: Workout): string {
  const exercises = new Set(workout.entries.map(entry => entry.exercise.id)).size;
  const sets = workout.entries.reduce((count, entry) => count + entry.sets.length, 0);
  return [
    workoutTimes(workout),
    exercises === 1 ? '1 exercise' : `${exercises} exercises`,
    sets === 1 ? '1 set' : `${sets} sets`,
  ].join(' · ');
}

// What finishing a Workout drops, for the lifter to hear first: the planned
// Sets never logged. Undefined when none are left.
export function plannedSetsDropped(workout: Pick<Workout, 'entries'>): string | undefined {
  const left = workout.entries.reduce((count, entry) => count + entry.plannedSets.length, 0);
  if (left === 0) return undefined;
  return left === 1
    ? "1 planned set wasn't logged and will be dropped."
    : `${left} planned sets weren't logged and will be dropped.`;
}

// How long ago a Workout on `localDate` was done, against today: "today",
// "yesterday", "9 days ago", then its date once two weeks have passed.
export function lastDone(localDate: string, today: string): string {
  const days = dayNumberOf(today) - dayNumberOf(localDate);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days < 14 ? `${days} days ago` : formatLocalDate(localDate);
}

// The line under a finished Workout's name when it's opened to edit: its date,
// then when it took place, e.g. "Saturday 12 Sep · 6:00 PM – 7:05 PM".
export function finishedWorkoutWhen(workout: Workout): string {
  return `${formatLocalDateWithWeekday(workout.localDate)} · ${workoutTimes(workout)}`;
}
