import { createTestDatabase } from './test-database';
import { clockAt, findExerciseByName, startWorkoutWith } from './test-helpers';
import { createTracker, type SetValues, type Tracker } from './tracker';

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

    const benchPress = await findExerciseByName(tracker, 'Bench Press');
    const lastTime = await tracker.getLastTime(benchPress.id);

    expect(lastTime?.localDate).toBe('2026-09-11');
    expect(lastTime?.sets.map(set => [set.weight, set.reps])).toEqual([
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

    const squat = await findExerciseByName(tracker, 'Squat');
    const lastTime = await tracker.getLastTime(squat.id);

    expect(lastTime?.localDate).toBe('2026-09-08');
    expect(lastTime?.sets.map(set => set.weight)).toEqual([100]);
  });

  it('leaves out warm-ups', async () => {
    const tracker = createTracker(createTestDatabase());
    await doWorkout(tracker, 'Squat', [
      { weight: 60, reps: 10, isWarmUp: true },
      { weight: 80, reps: 5, isWarmUp: true },
      { weight: 100, reps: 5 },
      { weight: 100, reps: 4 },
    ]);

    const squat = await findExerciseByName(tracker, 'Squat');
    const lastTime = await tracker.getLastTime(squat.id);

    expect(lastTime?.sets.map(set => [set.weight, set.reps])).toEqual([
      [100, 5],
      [100, 4],
    ]);
  });

  it('is nothing for an Exercise never done in a finished Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const deadlift = await findExerciseByName(tracker, 'Deadlift');

    expect(await tracker.getLastTime(deadlift.id)).toBeNull();
  });

  it('looks past a Workout where the Exercise was only warmed up', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Deadlift', [{ weight: 140, reps: 3 }]);
    clock.setTime('2026-09-11T18:00:00-04:00');
    await doWorkout(tracker, 'Deadlift', [{ weight: 60, reps: 5, isWarmUp: true }]);

    const deadlift = await findExerciseByName(tracker, 'Deadlift');
    const lastTime = await tracker.getLastTime(deadlift.id);

    expect(lastTime?.localDate).toBe('2026-09-08');
    expect(lastTime?.sets.map(set => set.weight)).toEqual([140]);
  });
});

// Starts, logs and finishes a Workout with one Exercise.
async function doWorkout(tracker: Tracker, exerciseName: string, loggedSets: SetValues[]) {
  const { workout, entry } = await startWorkoutWith(tracker, exerciseName);
  for (const set of loggedSets) await tracker.logSet(entry.id, set);
  await tracker.finishWorkout(workout.id);
  return { workout, entry };
}
