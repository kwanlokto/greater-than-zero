import { dayNumberOf, type Workout } from '@/core/tracker';
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

// What a Workout is called: its Category, e.g. "Push", or "Workout" when it
// has none.
export function workoutName(workout: Pick<Workout, 'categoryName'>): string {
  return workout.categoryName ?? 'Workout';
}

// "Bench Press, Dip": the Exercises in a Workout, in order, each once. Shown
// wherever a Workout is offered to start from, so it's never started blind.
export function workoutExercises(workout: Pick<Workout, 'entries'>): string {
  return [...new Set(workout.entries.map(entry => entry.exercise.name))].join(', ');
}

// How long ago a Workout on `localDate` was done, against today: "today",
// "yesterday", "9 days ago", then its date once two weeks have passed.
export function lastDone(localDate: string, today: string): string {
  const days = dayNumberOf(today) - dayNumberOf(localDate);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days < 14 ? `${days} days ago` : formatLocalDate(localDate);
}

// A finished Workout's title when it's opened to edit: its Category, or its
// date, e.g. "Saturday 12 Sep", when it has none.
export function finishedWorkoutTitle(workout: Workout): string {
  return workout.categoryName ?? formatLocalDateWithWeekday(workout.localDate);
}

// The line under that title: when it took place, after its date when the title
// is the Category.
export function finishedWorkoutWhen(workout: Workout): string {
  const times = workoutTimes(workout);
  return workout.categoryName === null
    ? times
    : `${formatLocalDateWithWeekday(workout.localDate)} · ${times}`;
}
