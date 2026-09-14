import { createTestDatabase } from './test-database';
import { clockAt, findExerciseByName, startWorkoutWith } from './test-helpers';
import { createTracker, restSecondsLeft } from './tracker';

describe('Rest', () => {
  it('starts when a Set is logged, lasting 2 minutes for an Exercise without its own length', async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');

    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-13T18:02:00-04:00'),
    );
  });

  it("lasts the Exercise's own rest length when it has one", async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const benchPress = await findExerciseByName(tracker, 'Bench Press');
    await tracker.setExerciseDefaultRest(benchPress.id, 180);
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');

    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    expect((await tracker.getExercise(benchPress.id))?.defaultRestSeconds).toBe(180);
    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-13T18:03:00-04:00'),
    );
  });

  it('starts over when the next Set is logged', async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    clock.setTime('2026-09-13T18:01:30-04:00');
    await tracker.logSet(entry.id, { weight: 60, reps: 7 });

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-13T18:03:30-04:00'),
    );
  });

  it('moves its end by 15 seconds either way', async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    const restEndsAt = async () => (await tracker.getWorkout(workout.id))?.restEndsAt;

    await tracker.moveRestEnd(workout.id, 15);
    expect(await restEndsAt()).toEqual(new Date('2026-09-13T18:02:15-04:00'));
    await tracker.moveRestEnd(workout.id, -15);
    await tracker.moveRestEnd(workout.id, -15);
    expect(await restEndsAt()).toEqual(new Date('2026-09-13T18:01:45-04:00'));
  });

  it('starts when "same as last set" logs a Set too', async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    clock.setTime('2026-09-13T18:02:30-04:00');
    await tracker.logSameAsLastSet(entry.id);

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-13T18:04:30-04:00'),
    );
  });

  it("doesn't start for a Set added to a finished Workout", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    await tracker.finishWorkout(workout.id);

    await tracker.logSet(entry.id, { weight: 60, reps: 7 });

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toBeNull();
  });

  it('keeps its end time when the app is reopened', async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const database = createTestDatabase();
    const tracker = createTracker(database, { now: clock.now });
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    const reopened = createTracker(database, { now: clock.now });

    expect((await reopened.getWorkoutInProgress())?.restEndsAt).toEqual(
      new Date('2026-09-13T18:02:00-04:00'),
    );
  });

  it('ends when the Workout is finished', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    await tracker.finishWorkout(workout.id);

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toBeNull();
  });

  it("can't be moved before one has started", async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await tracker.startWorkout();

    await expect(tracker.moveRestEnd(workout.id, 15)).rejects.toThrow('No rest has started');
  });
});

describe('Time left to rest', () => {
  it('is worked out from the end time', () => {
    const restEndsAt = new Date('2026-09-13T18:02:00-04:00');

    expect(restSecondsLeft(restEndsAt, new Date('2026-09-13T18:00:30-04:00'))).toBe(90);
  });

  it('is nothing once the rest is over', () => {
    const restEndsAt = new Date('2026-09-13T18:02:00-04:00');

    expect(restSecondsLeft(restEndsAt, new Date('2026-09-13T18:05:00-04:00'))).toBe(0);
  });

  it('is nothing when no rest has started', () => {
    expect(restSecondsLeft(null, new Date('2026-09-13T18:00:00-04:00'))).toBe(0);
  });
});

describe('Rest lengths', () => {
  it('default to 2 minutes', async () => {
    const tracker = createTracker(createTestDatabase());

    expect(await tracker.getFallbackRestSeconds()).toBe(120);
  });

  it("go back to the default when an Exercise's own length is cleared", async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const benchPress = await findExerciseByName(tracker, 'Bench Press');
    await tracker.setExerciseDefaultRest(benchPress.id, 180);
    await tracker.setExerciseDefaultRest(benchPress.id, null);
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');

    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-13T18:02:00-04:00'),
    );
  });

  it('are a whole number of seconds, at least 1', async () => {
    const tracker = createTracker(createTestDatabase());
    const benchPress = await findExerciseByName(tracker, 'Bench Press');

    await expect(tracker.setExerciseDefaultRest(benchPress.id, 0)).rejects.toThrow(
      'A rest length is a whole number of seconds, at least 1',
    );
    await expect(tracker.setExerciseDefaultRest(benchPress.id, 90.5)).rejects.toThrow(
      'A rest length is a whole number of seconds, at least 1',
    );
  });

  it("can't be set for a hidden Exercise", async () => {
    const tracker = createTracker(createTestDatabase());
    const created = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await tracker.hideExercise(created.id);

    await expect(tracker.setExerciseDefaultRest(created.id, 90)).rejects.toThrow(
      'No such Exercise in the library',
    );
  });
});
