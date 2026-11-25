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

// Each earlier Workout as [name, date].
async function earlierOf(tracker: Tracker, limit = 20) {
  const { workouts } = await tracker.getEarlierWorkouts(limit);
  return workouts.map(workout => [workout.categoryName, workout.localDate]);
}

describe('The earlier Workouts to repeat', () => {
  it('are every finished Workout the list of Workouts to repeat leaves out, the latest first', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const push = await tracker.createCategory('Push');
    const pull = await tracker.createCategory('Pull');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-03T18:00:00-05:00');
    await doCategoryWorkout(tracker, pull.id);
    clock.setTime('2026-11-04T18:00:00-05:00');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-06T18:00:00-05:00');
    await doCategoryWorkout(tracker, push.id);

    expect(await rowsOf(tracker)).toEqual([
      ['Push', '2026-11-06', ['Bench Press']],
      ['Pull', '2026-11-03', ['Bench Press']],
    ]);
    expect(await earlierOf(tracker)).toEqual([
      ['Push', '2026-11-04'],
      ['Push', '2026-11-02'],
    ]);
  });

  it('come as many as asked for, saying whether there are more, and a longer list carries on the shorter', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const push = await tracker.createCategory('Push');
    for (const day of ['03', '04', '05', '06']) {
      await doCategoryWorkout(tracker, push.id);
      clock.setTime(`2026-11-${day}T18:00:00-05:00`);
    }
    // Four Push Workouts, on the 2nd to the 5th: the 5th is the one to repeat.

    const firstTwo = await tracker.getEarlierWorkouts(2);
    const allThree = await tracker.getEarlierWorkouts(3);

    expect(firstTwo.workouts.map(workout => workout.localDate)).toEqual(['2026-11-04', '2026-11-03']);
    expect(firstTwo.more).toBe(true);
    expect(allThree.workouts.map(workout => workout.localDate)).toEqual([
      '2026-11-04',
      '2026-11-03',
      '2026-11-02',
    ]);
    expect(allThree.more).toBe(false);
    expect((await tracker.getEarlierWorkouts(10)).workouts).toHaveLength(3);
  });

  it('are none when every finished Workout is the latest of its kind', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    expect(await tracker.getEarlierWorkouts(20)).toEqual({ workouts: [], more: false });
    const push = await tracker.createCategory('Push');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-04T18:00:00-05:00');
    await doWorkoutOf(tracker, ['Squat']);

    expect(await tracker.getEarlierWorkouts(20)).toEqual({ workouts: [], more: false });
  });

  it('count Workouts in no Category as one kind when they hold the same Exercises', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const first = await doWorkoutOf(tracker, ['Bench Press', 'Dip']);
    clock.setTime('2026-11-04T18:00:00-05:00');
    await doWorkoutOf(tracker, ['Squat']);
    clock.setTime('2026-11-05T18:00:00-05:00');
    await doWorkoutOf(tracker, ['Dip', 'Bench Press']);

    const { workouts } = await tracker.getEarlierWorkouts(20);

    expect(workouts.map(workout => workout.id)).toEqual([first.id]);
  });

  it('put a backfilled Workout by the day it counts toward, not when it was typed in', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const push = await tracker.createCategory('Push');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-06T18:00:00-05:00');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-08T18:00:00-05:00');
    await doCategoryWorkout(tracker, push.id, { localDate: '2026-11-04' });

    expect(await rowsOf(tracker)).toEqual([['Push', '2026-11-06', ['Bench Press']]]);
    expect(await earlierOf(tracker)).toEqual([
      ['Push', '2026-11-04'],
      ['Push', '2026-11-02'],
    ]);
  });

  it('leave out Workouts in progress and deleted ones', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const push = await tracker.createCategory('Push');
    const { workout: deleted } = await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-04T18:00:00-05:00');
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-11-06T18:00:00-05:00');
    await doCategoryWorkout(tracker, push.id);
    await tracker.deleteWorkout(deleted.id);
    clock.setTime('2026-11-07T18:00:00-05:00');
    await tracker.startWorkout({ categoryId: push.id });

    expect(await earlierOf(tracker)).toEqual([['Push', '2026-11-04']]);
  });
});
