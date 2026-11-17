import type { Workout } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';

import {
  backfillTitle,
  finishedWorkoutTitle,
  finishedWorkoutWhen,
  workoutName,
} from './workout-labels';

function workoutWith(changes: Partial<Workout>): Workout {
  return {
    id: 'w1',
    localDate: '2026-09-12',
    startedAt: new Date(2026, 8, 12, 18, 0),
    finishedAt: new Date(2026, 8, 12, 19, 5),
    isBackfilled: false,
    restEndsAt: null,
    templateId: null,
    templateName: null,
    rotationId: null,
    entries: [],
    ...changes,
  };
}

const push = { templateId: 't1', templateName: 'Push' };

describe('Workout labels', () => {
  // Dates leave off this year's year, so fix the clock.
  beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 10, 16, 9, 0) }));
  afterEach(() => jest.useRealTimers());

  it("calls a Workout by its Template's name, or plain Workout when it started empty", () => {
    expect(workoutName(workoutWith(push))).toBe('Push');
    expect(workoutName(workoutWith({}))).toBe('Workout');
  });

  it("titles a finished Workout by its Template's name, with its date on the line under", () => {
    const workout = workoutWith(push);
    const times = `${formatTimeOfDay(workout.startedAt)} – ${formatTimeOfDay(workout.finishedAt!)}`;

    expect(finishedWorkoutTitle(workout)).toBe('Push');
    expect(finishedWorkoutWhen(workout)).toBe(`Saturday 12 Sep · ${times}`);
  });

  it('titles a finished Workout started empty by its date, as before', () => {
    const workout = workoutWith({});
    const times = `${formatTimeOfDay(workout.startedAt)} – ${formatTimeOfDay(workout.finishedAt!)}`;

    expect(finishedWorkoutTitle(workout)).toBe('Saturday 12 Sep');
    expect(finishedWorkoutWhen(workout)).toBe(times);
  });

  it('names the day a backfilled Workout is for', () => {
    expect(backfillTitle(workoutWith({ isBackfilled: true }))).toBe('Workout for 12 Sep');
    expect(backfillTitle(workoutWith(push))).toBeUndefined();
  });
});
