import type { Workout } from '@/core/tracker';
import { formatLocalDate, formatTimeOfDay } from '@/dates';

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
