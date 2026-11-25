import { createTestDatabase } from './test-database';
import {
  clockAt,
  createRotationWith,
  doCategoryWorkout,
  doWorkout,
  entriesOf,
  findExerciseByName,
  startWorkoutWithEach,
} from './test-helpers';
import { createTracker, type Tracker, type Workout } from './tracker';

// Each Exercise's name with its planned Sets, as [weight, unit, reps, W?].
function planOf(workout: Workout | undefined) {
  return workout?.entries.map(entry => [
    entry.exercise.name,
    entry.plannedSets.map(set => [set.weight, set.weightUnit, set.reps, set.isWarmUp]),
  ]);
}

// A finished Workout of Bench Press then Dip, a few Sets each.
async function pushDay(tracker: Tracker) {
  const { workout, entries } = await startWorkoutWithEach(tracker, ['Bench Press', 'Dip']);
  await tracker.logSet(entries[0].id, { weight: 60, reps: 10 }, 'kg');
  await tracker.logSet(entries[0].id, { weight: 62.5, reps: 8 }, 'kg');
  await tracker.logSet(entries[1].id, { weight: null, reps: 12 }, 'kg');
  await tracker.finishWorkout(workout.id);
  return workout;
}

describe('Repeating a Workout', () => {
  it('starts with the same Exercises in order, each logged Set planned as it was done', async () => {
    const tracker = createTracker(createTestDatabase());
    const done = await pushDay(tracker);

    const repeat = await tracker.startWorkout({ repeatOf: done.id });

    const started = await tracker.getWorkout(repeat.id);
    expect(started?.finishedAt).toBeNull();
    expect(started?.entries.map(entry => entry.sets.length)).toEqual([0, 0]);
    expect(planOf(started)).toEqual([
      [
        'Bench Press',
        [
          [60, 'kg', 10, false],
          [62.5, 'kg', 8, false],
        ],
      ],
      ['Dip', [[null, 'kg', 12, false]]],
    ]);
  });

  it('plans a warm-up as a warm-up, and confirming it logs one', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, ['Squat']);
    await tracker.logSet(entries[0].id, { weight: 40, reps: 10, isWarmUp: true }, 'kg');
    await tracker.logSet(entries[0].id, { weight: 100, reps: 5 }, 'kg');
    await tracker.finishWorkout(workout.id);

    const repeat = await tracker.startWorkout({ repeatOf: workout.id });

    const [entry] = await entriesOf(tracker, repeat.id);
    expect(entry.plannedSets.map(set => set.isWarmUp)).toEqual([true, false]);
    await tracker.confirmPlannedSet(entry.plannedSets[0].id, { weight: 40, reps: 10 });
    await tracker.confirmPlannedSet(entry.plannedSets[1].id, { weight: 100, reps: 5 });
    const [confirmed] = await entriesOf(tracker, repeat.id);
    expect(confirmed.sets.map(set => [set.weight, set.isWarmUp])).toEqual([
      [40, true],
      [100, false],
    ]);
  });

  it("keeps each Set's unit, and a bodyweight Set's added or assisted weight", async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('kg');
    const { workout, entries } = await startWorkoutWithEach(tracker, ['Bench Press', 'Pull-up']);
    await tracker.logSet(entries[0].id, { weight: 135, reps: 8 }, 'lb');
    await tracker.logSet(entries[1].id, { weight: 10, reps: 6 }, 'kg');
    await tracker.logSet(entries[1].id, { weight: -20, reps: 8 }, 'lb');
    await tracker.finishWorkout(workout.id);

    const repeat = await tracker.startWorkout({ repeatOf: workout.id });

    expect(planOf(await tracker.getWorkout(repeat.id))).toEqual([
      ['Bench Press', [[135, 'lb', 8, false]]],
      [
        'Pull-up',
        [
          [10, 'kg', 6, false],
          [-20, 'lb', 8, false],
        ],
      ],
    ]);
  });

  it('brings along an Exercise nothing was logged for, with nothing planned', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, ['Bench Press', 'Dip']);
    await tracker.logSet(entries[0].id, { weight: 60, reps: 10 }, 'kg');
    await tracker.finishWorkout(workout.id);

    const repeat = await tracker.startWorkout({ repeatOf: workout.id });

    expect(planOf(await tracker.getWorkout(repeat.id))).toEqual([
      ['Bench Press', [[60, 'kg', 10, false]]],
      ['Dip', []],
    ]);
  });

  it('leaves out Sets deleted and Exercises removed from the Workout since', async () => {
    const tracker = createTracker(createTestDatabase());
    const done = await pushDay(tracker);
    const [bench, dip] = await entriesOf(tracker, done.id);
    await tracker.deleteSet(bench.sets[0].id);
    await tracker.removeExerciseFromWorkout(dip.id);

    const repeat = await tracker.startWorkout({ repeatOf: done.id });

    expect(planOf(await tracker.getWorkout(repeat.id))).toEqual([
      ['Bench Press', [[62.5, 'kg', 8, false]]],
    ]);
  });

  it("takes its numbers from the Workout picked, not the Exercise's latest session", async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const earlier = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);
    clock.setTime('2026-11-09T18:00:00-05:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 70, reps: 5 }]);
    clock.setTime('2026-11-16T18:00:00-05:00');

    const repeat = await tracker.startWorkout({ repeatOf: earlier.id });

    const [entry] = await entriesOf(tracker, repeat.id);
    expect(entry.plannedSets.map(set => [set.weight, set.reps])).toEqual([[60, 10]]);
    expect(entry.lastTime?.sets.map(set => [set.weight, set.reps])).toEqual([[70, 5]]);
  });

  it('is a copy: changing it never changes the Workout it came from', async () => {
    const tracker = createTracker(createTestDatabase());
    const done = await pushDay(tracker);
    const before = await tracker.getWorkout(done.id);

    const repeat = await tracker.startWorkout({ repeatOf: done.id });
    const [bench, dip] = await entriesOf(tracker, repeat.id);
    await tracker.confirmPlannedSet(bench.plannedSets[0].id, { weight: 65, reps: 10 });
    await tracker.removeExerciseFromWorkout(dip.id);
    const squat = await findExerciseByName(tracker, 'Squat');
    await tracker.addExerciseToWorkout(repeat.id, squat.id);
    await tracker.finishWorkout(repeat.id);

    expect(await tracker.getWorkout(done.id)).toEqual(before);
  });

  it('starts today, in progress and not backfilled', async () => {
    const clock = clockAt('2026-11-02T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const done = await pushDay(tracker);
    clock.setTime('2026-11-16T07:30:00-05:00');

    const repeat = await tracker.startWorkout({ repeatOf: done.id });

    expect(await tracker.getWorkoutInProgress()).toMatchObject({
      id: repeat.id,
      localDate: '2026-11-16',
      isBackfilled: false,
      restEndsAt: null,
    });
  });

  it('only repeats a finished Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout } = await startWorkoutWithEach(tracker, ['Bench Press']);

    await expect(tracker.startWorkout({ repeatOf: workout.id })).rejects.toThrow(
      'No such finished Workout',
    );
    await expect(tracker.startWorkout({ repeatOf: 'no-such-workout' })).rejects.toThrow(
      'No such finished Workout',
    );
  });

  it('is refused while another Workout is in progress', async () => {
    const tracker = createTracker(createTestDatabase());
    const done = await pushDay(tracker);
    await tracker.startWorkout();

    await expect(tracker.startWorkout({ repeatOf: done.id })).rejects.toThrow(
      'A Workout is already in progress',
    );
  });

  it('is refused onto a past date, or together with a Category', async () => {
    const clock = clockAt('2026-11-16T18:00:00-05:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const done = await pushDay(tracker);
    const push = await tracker.createCategory('Push');

    await expect(
      tracker.startWorkout({ repeatOf: done.id, localDate: '2026-11-10' }),
    ).rejects.toThrow('A Workout is repeated onto today, on its own');
    await expect(
      tracker.startWorkout({ repeatOf: done.id, categoryId: push.id }),
    ).rejects.toThrow('A Workout is repeated onto today, on its own');
  });

  it('stays in the Category of the Workout it repeats, counting toward the Rotation as that does', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, categories } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull']);
    await tracker.setActiveRotation(rotation.id);
    const { workout: push } = await doCategoryWorkout(tracker, categories[0].id);
    await doCategoryWorkout(tracker, categories[1].id);
    expect((await tracker.getNextUp())?.name).toBe('Push');

    const repeat = await tracker.startWorkout({ repeatOf: push.id });

    const started = await tracker.getWorkout(repeat.id);
    expect(started).toMatchObject({ categoryId: categories[0].id, categoryName: 'Push' });
    await tracker.confirmPlannedSet(started!.entries[0].plannedSets[0].id, {
      weight: 60,
      reps: 10,
    });
    await tracker.finishWorkout(repeat.id);
    expect((await tracker.getNextUp())?.name).toBe('Pull');
  });

  it('stays in that Category even when its Exercises are swapped on the day', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const { workout: done } = await doCategoryWorkout(tracker, push.id);

    const repeat = await tracker.startWorkout({ repeatOf: done.id });
    const [bench] = await entriesOf(tracker, repeat.id);
    const dip = await findExerciseByName(tracker, 'Dip');
    await tracker.swapExercise(bench.id, dip.id);

    expect(await tracker.getWorkout(repeat.id)).toMatchObject({ categoryName: 'Push' });
  });

  it('is in no Category when the Workout it repeats has none', async () => {
    const tracker = createTracker(createTestDatabase());
    const done = await pushDay(tracker);

    const repeat = await tracker.startWorkout({ repeatOf: done.id });

    expect(await tracker.getWorkout(repeat.id)).toMatchObject({
      categoryId: null,
      categoryName: null,
    });
  });
});
