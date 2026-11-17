import type { Workout } from '@/core/tracker';
import { formatLocalDate, formatLocalDateWithWeekday, formatTimeOfDay } from '@/dates';

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

// What a Workout is called: its Template's name, e.g. "Push", or "Workout" for
// one started empty.
export function workoutName(workout: Pick<Workout, 'templateName'>): string {
  return workout.templateName ?? 'Workout';
}

// A finished Workout's title when it's opened to edit: its Template's name, or
// its date, e.g. "Saturday 12 Sep", for one started empty.
export function finishedWorkoutTitle(workout: Workout): string {
  return workout.templateName ?? formatLocalDateWithWeekday(workout.localDate);
}

// The line under that title: when it took place, after its date when the title
// is the Template's name.
export function finishedWorkoutWhen(workout: Workout): string {
  const times = workoutTimes(workout);
  return workout.templateName === null
    ? times
    : `${formatLocalDateWithWeekday(workout.localDate)} · ${times}`;
}
