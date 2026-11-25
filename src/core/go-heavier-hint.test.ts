import { createTestDatabase } from './test-database';
import {
  clockAt,
  doWorkout,
  entryToLog,
  findExerciseByName,
  startWorkoutWith,
} from './test-helpers';
import { createTracker, type SetValues, type Tracker } from './tracker';

// Whether the hint shows for an Exercise in a new Workout started now.
async function hintFor(tracker: Tracker, exerciseName: string) {
  const { workout, entry } = await startWorkoutWith(tracker, exerciseName);
  const { readyToGoHeavier } = await entryToLog(tracker, workout.id, entry.id);
  await tracker.discardWorkout(workout.id);
  return readyToGoHeavier;
}

// A tracker whose last session of the Exercise logged these Sets, a week ago.
async function trackerAfter(exerciseName: string, loggedSets: SetValues[]) {
  const clock = clockAt('2026-11-09T18:00:00-05:00');
  const tracker = createTracker(createTestDatabase(), clock);
  await doWorkout(tracker, exerciseName, loggedSets);
  clock.setTime('2026-11-16T18:00:00-05:00');
  return { tracker, clock };
}

describe('The "ready to go heavier" hint', () => {
  it("shows when every working Set last session reached the top of the Exercise's rep range", async () => {
    const { tracker } = await trackerAfter('Bench Press', [
      { weight: 60, reps: 12 },
      { weight: 60, reps: 13 },
      { weight: 62.5, reps: 12 },
    ]);

    expect(await hintFor(tracker, 'Bench Press')).toBe(true);
  });

  it("doesn't show when one working Set fell short of the top", async () => {
    const { tracker } = await trackerAfter('Bench Press', [
      { weight: 60, reps: 12 },
      { weight: 60, reps: 11 },
    ]);

    expect(await hintFor(tracker, 'Bench Press')).toBe(false);
  });

  it('ignores warm-up Sets', async () => {
    const { tracker } = await trackerAfter('Bench Press', [
      { weight: 20, reps: 5, isWarmUp: true },
      { weight: 60, reps: 12 },
    ]);

    expect(await hintFor(tracker, 'Bench Press')).toBe(true);
  });

  it("doesn't show after a session where the Exercise was only warmed up", async () => {
    const { tracker, clock } = await trackerAfter('Bench Press', [{ weight: 60, reps: 12 }]);
    await doWorkout(tracker, 'Bench Press', [{ weight: 20, reps: 15, isWarmUp: true }]);
    clock.setTime('2026-11-18T18:00:00-05:00');

    expect(await hintFor(tracker, 'Bench Press')).toBe(false);
  });

  it("doesn't show for an Exercise never done, or done only in a Workout since deleted", async () => {
    const { tracker } = await trackerAfter('Bench Press', [{ weight: 60, reps: 12 }]);
    const [{ id }] = (await tracker.getDay('2026-11-09')).workouts;
    await tracker.deleteWorkout(id);

    expect(await hintFor(tracker, 'Bench Press')).toBe(false);
    expect(await hintFor(tracker, 'Squat')).toBe(false);
  });

  it("goes by the Exercise's rep range as it is now", async () => {
    const { tracker } = await trackerAfter('Squat', [
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
    ]);
    const squat = await findExerciseByName(tracker, 'Squat');
    expect(await hintFor(tracker, 'Squat')).toBe(false);

    await tracker.setExerciseRepRange(squat.id, { minReps: 3, maxReps: 5 });

    expect(await hintFor(tracker, 'Squat')).toBe(true);
  });

  it('follows the same rule for a bodyweight Exercise, whatever weight was added', async () => {
    const { tracker } = await trackerAfter('Pull-up', [
      { weight: null, reps: 12 },
      { weight: 10, reps: 12 },
      { weight: -20, reps: 14 },
    ]);

    expect(await hintFor(tracker, 'Pull-up')).toBe(true);
  });

  it('looks at the most recent session before the Workout, and only while it is in progress', async () => {
    const { tracker, clock } = await trackerAfter('Bench Press', [{ weight: 60, reps: 12 }]);
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 62.5, reps: 8 }, 'kg');
    expect((await entryToLog(tracker, workout.id, entry.id)).readyToGoHeavier).toBe(true);

    await tracker.finishWorkout(workout.id);
    clock.setTime('2026-11-18T18:00:00-05:00');

    expect((await entryToLog(tracker, workout.id, entry.id)).readyToGoHeavier).toBe(false);
    expect(await hintFor(tracker, 'Bench Press')).toBe(false);
  });
});
