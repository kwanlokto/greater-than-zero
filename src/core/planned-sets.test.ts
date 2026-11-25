import { createTestDatabase } from './test-database';
import {
  clockAt,
  entriesOf,
  findExerciseByName,
  setsOf,
  startWorkoutWithEach,
  weightsAndReps,
} from './test-helpers';
import { canFinishWorkout, createTracker, type Tracker, type WeightUnit } from './tracker';

// A repeat, in progress, of a Workout with three Sets of Bench Press, 60 × 8
// in `unit`, and one of Dip.
async function repeatOfPushDay(tracker: Tracker, unit: WeightUnit = 'kg') {
  const { workout, entries } = await startWorkoutWithEach(tracker, ['Bench Press', 'Dip']);
  for (let set = 0; set < 3; set++) {
    await tracker.logSet(entries[0].id, { weight: 60, reps: 8 }, unit);
  }
  await tracker.logSet(entries[1].id, { weight: null, reps: 12 }, unit);
  await tracker.finishWorkout(workout.id);
  return tracker.startWorkout({ repeatOf: workout.id });
}

describe('Confirming a planned Set', () => {
  it('logs it with the numbers confirmed, in the unit it was planned in, and takes it off the plan', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const workout = await repeatOfPushDay(tracker, 'kg');
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);

    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 });

    const [entry] = await entriesOf(tracker, workout.id);
    expect(entry.sets.map(set => [set.weight, set.weightUnit, set.reps, set.isWarmUp])).toEqual([
      [60, 'kg', 10, false],
    ]);
    expect(entry.plannedSets.map(set => set.id)).toEqual([plannedSets[1].id, plannedSets[2].id]);
  });

  it('logs the numbers as changed on the day', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await repeatOfPushDay(tracker);
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);

    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 57.5, reps: 6 });

    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[57.5, 6]]);
  });

  it('starts the rest, like any logged Set', async () => {
    const clock = clockAt('2026-09-28T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const workout = await repeatOfPushDay(tracker);
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);
    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toBeNull();
    clock.setTime('2026-09-28T18:05:00');

    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 });

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-28T18:07:00'),
    );
  });

  it('is refused when the numbers make no Set, leaving it planned', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await repeatOfPushDay(tracker);
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);

    await expect(
      tracker.confirmPlannedSet(plannedSets[0].id, { weight: null, reps: 10 }),
    ).rejects.toThrow('A weighted Set needs a weight');
    const [entry] = await entriesOf(tracker, workout.id);
    expect([entry.sets.length, entry.plannedSets.length]).toEqual([0, 3]);
  });

  it("can't happen twice", async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await repeatOfPushDay(tracker);
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);
    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 });

    await expect(
      tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 }),
    ).rejects.toThrow('No such planned Set');
    expect(await setsOf(tracker, workout.id)).toHaveLength(1);
  });
});

describe('Swapping an Exercise with planned Sets', () => {
  it('keeps the planned Sets and their reps, but not the weight', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('kg');
    const workout = await repeatOfPushDay(tracker, 'lb');
    const [entry] = await entriesOf(tracker, workout.id);
    const incline = await findExerciseByName(tracker, 'Incline Bench Press');

    await tracker.swapExercise(entry.id, incline.id);

    // The weight was what Bench Press was done at, so it's typed afresh, in
    // the display unit.
    const [swapped] = await entriesOf(tracker, workout.id);
    expect(swapped.exercise.name).toBe('Incline Bench Press');
    expect(swapped.plannedSets.map(set => [set.weight, set.weightUnit, set.reps])).toEqual([
      [null, 'kg', 8],
      [null, 'kg', 8],
      [null, 'kg', 8],
    ]);
  });

  it('logs a kept planned Set to the Exercise swapped in, in the display unit', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('kg');
    const workout = await repeatOfPushDay(tracker, 'lb');
    const [entry] = await entriesOf(tracker, workout.id);
    const incline = await findExerciseByName(tracker, 'Incline Bench Press');
    await tracker.swapExercise(entry.id, incline.id);
    const [swapped] = await entriesOf(tracker, workout.id);

    await tracker.confirmPlannedSet(swapped.plannedSets[0].id, { weight: 30, reps: 9 });

    const [logged] = await entriesOf(tracker, workout.id);
    expect(logged.exercise.name).toBe('Incline Bench Press');
    expect(logged.sets.map(set => [set.weight, set.weightUnit, set.reps])).toEqual([[30, 'kg', 9]]);
    expect(logged.plannedSets).toHaveLength(2);
  });
});

describe('Finishing a Workout with planned Sets', () => {
  it('drops the ones never confirmed, keeping the logged ones', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await repeatOfPushDay(tracker);
    const [bench] = await entriesOf(tracker, workout.id);
    await tracker.confirmPlannedSet(bench.plannedSets[0].id, { weight: 60, reps: 10 });

    await tracker.finishWorkout(workout.id);

    const finished = await tracker.getWorkout(workout.id);
    expect(
      finished?.entries.map(entry => [
        entry.exercise.name,
        entry.sets.length,
        entry.plannedSets.length,
      ]),
    ).toEqual([
      ['Bench Press', 1, 0],
      ['Dip', 0, 0],
    ]);
  });

  it('needs a logged Set: planned ones alone are nothing done', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await repeatOfPushDay(tracker);
    const started = { entries: await entriesOf(tracker, workout.id) };

    expect(canFinishWorkout(started)).toBe(false);
    await expect(tracker.finishWorkout(workout.id)).rejects.toThrow(
      'A Workout needs at least one Set to be finished',
    );
  });

  it('leaves them out of the next repeat and of "last time"', async () => {
    const tracker = createTracker(createTestDatabase());
    const first = await repeatOfPushDay(tracker);
    const [entry] = await entriesOf(tracker, first.id);
    await tracker.confirmPlannedSet(entry.plannedSets[0].id, { weight: 60, reps: 12 });
    await tracker.finishWorkout(first.id);

    const second = await tracker.startWorkout({ repeatOf: first.id });

    const [next] = await entriesOf(tracker, second.id);
    expect(next.plannedSets.map(set => set.reps)).toEqual([12]);
    expect(next.lastTime?.sets.map(set => set.reps)).toEqual([12]);
  });
});
