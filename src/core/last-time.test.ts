import { createTestDatabase } from './test-database';
import {
  clockAt,
  doWorkout,
  findExerciseByName,
  startWorkoutWith,
  weightsAndReps,
} from './test-helpers';
import { createTracker, type Tracker } from './tracker';

describe('Last time', () => {
  it('shows the working Sets from the most recent finished Workout with the Exercise', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Bench Press', [
      { weight: 60, reps: 8 },
      { weight: 60, reps: 7 },
    ]);
    clock.setTime('2026-09-11T18:00:00-04:00');
    await doWorkout(tracker, 'Bench Press', [
      { weight: 62.5, reps: 6 },
      { weight: 62.5, reps: 5 },
    ]);

    const lastTime = await lastTimeOf(tracker, 'Bench Press');

    expect(lastTime?.localDate).toBe('2026-09-11');
    expect(weightsAndReps(lastTime?.sets ?? [])).toEqual([
      [62.5, 6],
      [62.5, 5],
    ]);
  });

  it('ignores the Workout still in progress', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    clock.setTime('2026-09-11T18:00:00-04:00');
    const today = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(today.entry.id, { weight: 105, reps: 5 });

    const lastTime = await lastTimeOf(tracker, 'Squat');

    expect(lastTime?.localDate).toBe('2026-09-08');
    expect(weightsAndReps(lastTime?.sets ?? [])).toEqual([[100, 5]]);
  });

  it('leaves out warm-ups', async () => {
    const tracker = createTracker(createTestDatabase());
    await doWorkout(tracker, 'Squat', [
      { weight: 60, reps: 10, isWarmUp: true },
      { weight: 80, reps: 5, isWarmUp: true },
      { weight: 100, reps: 5 },
      { weight: 100, reps: 4 },
    ]);

    const lastTime = await lastTimeOf(tracker, 'Squat');

    expect(weightsAndReps(lastTime?.sets ?? [])).toEqual([
      [100, 5],
      [100, 4],
    ]);
  });

  it('is nothing for an Exercise never done in a finished Workout', async () => {
    const tracker = createTracker(createTestDatabase());

    expect(await lastTimeOf(tracker, 'Deadlift')).toBeNull();
  });

  it('looks past a Workout where the Exercise was only warmed up', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Deadlift', [{ weight: 140, reps: 3 }]);
    clock.setTime('2026-09-11T18:00:00-04:00');
    await doWorkout(tracker, 'Deadlift', [{ weight: 60, reps: 5, isWarmUp: true }]);

    const lastTime = await lastTimeOf(tracker, 'Deadlift');

    expect(lastTime?.localDate).toBe('2026-09-08');
    expect(weightsAndReps(lastTime?.sets ?? [])).toEqual([[140, 3]]);
  });

  it('shows a session logged in mixed units in whichever display unit is chosen', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 225, reps: 5 });
    await tracker.setDisplayUnit('kg');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(workout.id);
    const shown = async () =>
      (await lastTimeOf(tracker, 'Squat'))?.sets.map(set => set.displayWeight);

    expect(await shown()).toEqual([
      { value: 102.1, unit: 'kg' },
      { value: 100, unit: 'kg' },
    ]);
    await tracker.setDisplayUnit('lb');
    expect(await shown()).toEqual([
      { value: 225, unit: 'lb' },
      { value: 220.5, unit: 'lb' },
    ]);
  });
});

async function lastTimeOf(tracker: Tracker, exerciseName: string) {
  const exercise = await findExerciseByName(tracker, exerciseName);
  return tracker.getLastTime(exercise.id);
}
