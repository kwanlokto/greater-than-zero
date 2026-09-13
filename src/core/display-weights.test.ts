import { createTestDatabase } from './test-database';
import { doWorkout, findExerciseByName, setsOf, startWorkoutWith } from './test-helpers';
import { createTracker } from './tracker';

describe('Weights on screen', () => {
  it('are shown in the display unit, whatever unit they were entered in', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.setDisplayUnit('lb');
    await tracker.logSet(entry.id, { weight: 135, reps: 5 });
    await tracker.setDisplayUnit('kg');
    await tracker.logSet(entry.id, { weight: 60, reps: 5 });
    const shown = async () => (await setsOf(tracker, workout.id)).map(set => set.displayWeight);

    expect(await shown()).toEqual([
      { value: 61.2, unit: 'kg' },
      { value: 60, unit: 'kg' },
    ]);
    await tracker.setDisplayUnit('lb');
    expect(await shown()).toEqual([
      { value: 135, unit: 'lb' },
      { value: 132.3, unit: 'lb' },
    ]);
  });

  it('never change the records when the display unit changes', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.setDisplayUnit('lb');
    await tracker.logSet(entry.id, { weight: 135, reps: 5 });

    await tracker.setDisplayUnit('kg');
    await tracker.setDisplayUnit('lb');
    await tracker.setDisplayUnit('kg');

    expect(await setsOf(tracker, workout.id)).toMatchObject([{ weight: 135, weightUnit: 'lb' }]);
  });

  it('are shown to at most one decimal place, even in the unit they were entered in', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');

    await tracker.logSet(entry.id, { weight: 102.25, reps: 5 });

    expect((await setsOf(tracker, workout.id))[0].displayWeight).toEqual({ value: 102.3, unit: 'kg' });
  });

  it('round halves away from zero, so help from a machine rounds like added weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Dip');
    await tracker.logSet(entry.id, { weight: 20.25, reps: 8 });
    await tracker.logSet(entry.id, { weight: -20.25, reps: 8 });

    expect((await setsOf(tracker, workout.id)).map(set => set.displayWeight?.value)).toEqual([
      20.3, -20.3,
    ]);
  });

  it('convert added bodyweight too, and leave plain bodyweight blank', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Pull-up');
    await tracker.logSet(entry.id, { weight: -20, reps: 10 });
    await tracker.logSet(entry.id, { weight: null, reps: 8 });

    await tracker.setDisplayUnit('lb');

    expect((await setsOf(tracker, workout.id)).map(set => set.displayWeight)).toEqual([
      { value: -44.1, unit: 'lb' },
      null,
    ]);
  });

  it('are shown in the display unit for "last time" too', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    await doWorkout(tracker, 'Deadlift', [{ weight: 315, reps: 3 }]);

    await tracker.setDisplayUnit('kg');
    const deadlift = await findExerciseByName(tracker, 'Deadlift');
    const lastTime = await tracker.getLastTime(deadlift.id);

    expect(lastTime?.sets.map(set => set.displayWeight)).toEqual([{ value: 142.9, unit: 'kg' }]);
  });
});
