import { createTestDatabase } from './test-database';
import { clockAt, doCategoryWorkout, startWorkoutWithEach } from './test-helpers';
import { createTracker, type Tracker } from './tracker';

// Starts, logs a Set in each Exercise and finishes a Workout started empty.
async function doWorkoutOf(tracker: Tracker, exerciseNames: string[]) {
  const { workout, entries } = await startWorkoutWithEach(tracker, exerciseNames);
  for (const entry of entries) await tracker.logSet(entry.id, { weight: 20, reps: 10 }, 'kg');
  await tracker.finishWorkout(workout.id);
  return workout;
}

// Each row as [name, date, Exercises].
async function rowsOf(tracker: Tracker) {
  return (await tracker.getWorkoutsToRepeat()).map(workout => [
    workout.categoryName,
    workout.localDate,
    workout.entries.map(entry => entry.exercise.name),
  ]);
}

describe('The Workouts to repeat', () => {
  it('are one per Category: its latest finished Workout', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const push = await tracker.createCategory('Push');
    const pull = await tracker.createCategory('Pull');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-04T18:00:00-05:00');
    await doCategoryWorkout(tracker, pull.id);
    clock.setTime('2026-11-06T18:00:00-05:00');
    const { workout: latestPush } = await doCategoryWorkout(tracker, push.id);

    const toRepeat = await tracker.getWorkoutsToRepeat();

    expect(toRepeat.map(workout => workout.id)).toContain(latestPush.id);
    expect(await rowsOf(tracker)).toEqual([
      ['Push', '2026-11-06', ['Bench Press']],
      ['Pull', '2026-11-04', ['Bench Press']],
    ]);
  });

  it('group Workouts in no Category that hold the same Exercises, in any order', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkoutOf(tracker, ['Bench Press', 'Dip']);
    clock.setTime('2026-11-05T18:00:00-05:00');
    const latest = await doWorkoutOf(tracker, ['Dip', 'Bench Press']);

    const toRepeat = await tracker.getWorkoutsToRepeat();

    expect(toRepeat.map(workout => workout.id)).toEqual([latest.id]);
    expect(await rowsOf(tracker)).toEqual([[null, '2026-11-05', ['Dip', 'Bench Press']]]);
  });

  it('keep Workouts with different Exercises apart, however alike', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkoutOf(tracker, ['Bench Press', 'Dip']);
    clock.setTime('2026-11-05T18:00:00-05:00');
    await doWorkoutOf(tracker, ['Bench Press']);
    clock.setTime('2026-11-07T18:00:00-05:00');
    await doWorkoutOf(tracker, ['Bench Press', 'Dip', 'Squat']);

    expect(await rowsOf(tracker)).toEqual([
      [null, '2026-11-07', ['Bench Press', 'Dip', 'Squat']],
      [null, '2026-11-05', ['Bench Press']],
      [null, '2026-11-02', ['Bench Press', 'Dip']],
    ]);
  });

  it("keep a Category's Workouts apart from ones in none with the same Exercises", async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const push = await tracker.createCategory('Push');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-05T18:00:00-05:00');
    await doWorkoutOf(tracker, ['Bench Press']);

    expect(await rowsOf(tracker)).toEqual([
      [null, '2026-11-05', ['Bench Press']],
      ['Push', '2026-11-02', ['Bench Press']],
    ]);
  });

  it('go by the Exercises still in a Workout, after one is removed', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkoutOf(tracker, ['Bench Press']);
    clock.setTime('2026-11-05T18:00:00-05:00');
    const second = await doWorkoutOf(tracker, ['Bench Press', 'Dip']);
    const dip = (await tracker.getWorkout(second.id))!.entries[1];
    await tracker.removeExerciseFromWorkout(dip.id);

    expect(await rowsOf(tracker)).toEqual([[null, '2026-11-05', ['Bench Press']]]);
  });

  it('leave out Workouts in progress and deleted ones, and start empty', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    expect(await tracker.getWorkoutsToRepeat()).toEqual([]);
    const deleted = await doWorkoutOf(tracker, ['Squat']);
    await tracker.deleteWorkout(deleted.id);
    clock.setTime('2026-11-05T18:00:00-05:00');
    await startWorkoutWithEach(tracker, ['Bench Press']);

    expect(await tracker.getWorkoutsToRepeat()).toEqual([]);
  });
});
