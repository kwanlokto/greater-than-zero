import { createTestDatabase } from './test-database';
import {
  clockAt,
  doWorkout,
  findExerciseByName,
  names,
  setsOf,
  startWorkoutWith,
  startWorkoutWithEach,
  weightsAndReps,
} from './test-helpers';
import { createTracker, type Tracker } from './tracker';

describe('Workouts', () => {
  it('start empty and stay in progress until finished', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });

    const started = await tracker.startWorkout();

    expect(await tracker.getWorkout(started.id)).toEqual({
      id: started.id,
      localDate: '2026-09-12',
      startedAt: new Date('2026-09-12T18:00:00-04:00'),
      finishedAt: null,
      restEndsAt: null,
      entries: [],
    });
  });

  it("record the phone's local calendar date, even late at night", async () => {
    // 23:30 in Toronto is already the next day in UTC.
    const clock = clockAt('2026-09-12T23:30:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });

    const started = await tracker.startWorkout();

    expect((await tracker.getWorkout(started.id))?.localDate).toBe('2026-09-12');
  });

  it("can't start while another is in progress", async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.startWorkout();

    await expect(tracker.startWorkout()).rejects.toThrow('A Workout is already in progress');
  });

  it('start only once when Start is pressed twice at the same moment', async () => {
    const tracker = createTracker(createTestDatabase());

    const results = await Promise.allSettled([tracker.startWorkout(), tracker.startWorkout()]);

    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
  });

  it('record the finish time, keeping the start time and the date they started on', async () => {
    const clock = clockAt('2026-09-12T23:30:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });

    clock.setTime('2026-09-13T00:45:00-04:00');
    await tracker.finishWorkout(workout.id);

    expect(await tracker.getWorkout(workout.id)).toMatchObject({
      localDate: '2026-09-12',
      startedAt: new Date('2026-09-12T23:30:00-04:00'),
      finishedAt: new Date('2026-09-13T00:45:00-04:00'),
    });
  });

  it('keep their first finish time if finished again', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    clock.setTime('2026-09-12T19:00:00-04:00');
    await tracker.finishWorkout(workout.id);

    clock.setTime('2026-09-12T21:00:00-04:00');
    await expect(tracker.finishWorkout(workout.id)).rejects.toThrow('That Workout is not in progress');
    expect((await tracker.getWorkout(workout.id))?.finishedAt).toEqual(
      new Date('2026-09-12T19:00:00-04:00'),
    );
  });

  it("can't be finished until a Set is logged, and stay in progress", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout } = await startWorkoutWith(tracker, 'Squat');

    await expect(tracker.finishWorkout(workout.id)).rejects.toThrow(
      'A Workout needs at least one Set to be finished',
    );
    expect((await tracker.getWorkoutInProgress())?.id).toBe(workout.id);
  });

  it("can't be finished once every Set logged has been deleted or gone with its Exercise", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, ['Squat', 'Bench Press']);
    await tracker.logSet(entries[0].id, { weight: 100, reps: 5 });
    await tracker.logSet(entries[1].id, { weight: 60, reps: 8 });
    const [squatSet] = await setsOf(tracker, workout.id);
    await tracker.deleteSet(squatSet.id);
    await tracker.removeExerciseFromWorkout(entries[1].id);

    await expect(tracker.finishWorkout(workout.id)).rejects.toThrow(
      'A Workout needs at least one Set to be finished',
    );
  });

  it('can be finished with only warm-ups logged', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 60, reps: 10, isWarmUp: true });

    await tracker.finishWorkout(workout.id);

    expect(await tracker.getWorkoutInProgress()).toBeNull();
  });

  it('are found as the Workout in progress until finished', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });

    expect((await tracker.getWorkoutInProgress())?.id).toBe(workout.id);
    await tracker.finishWorkout(workout.id);
    expect(await tracker.getWorkoutInProgress()).toBeNull();
  });

  it('are still in progress, with every Set, when the app is reopened', async () => {
    const database = createTestDatabase();
    const tracker = createTracker(database);
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    await tracker.logSet(entry.id, { weight: 60, reps: 7 });

    // A new core on the same database, as after the app is killed and reopened.
    const reopened = createTracker(database);
    const resumed = await reopened.getWorkoutInProgress();

    expect(resumed?.id).toBe(workout.id);
    expect(resumed?.entries[0].sets).toMatchObject([
      { weight: 60, weightUnit: 'kg', reps: 8 },
      { weight: 60, weightUnit: 'kg', reps: 7 },
    ]);
  });

  it('can start again once the last one is finished', async () => {
    const tracker = createTracker(createTestDatabase());
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);

    const second = await tracker.startWorkout();

    expect((await tracker.getWorkoutInProgress())?.id).toBe(second.id);
  });

  it('list their Exercises in the order they were added', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await tracker.startWorkout();

    for (const name of ['Squat', 'Bench Press', 'Barbell Row']) {
      const exercise = await findExerciseByName(tracker, name);
      await tracker.addExerciseToWorkout(workout.id, exercise.id);
    }

    const entries = (await tracker.getWorkout(workout.id))?.entries ?? [];
    expect(names(entries.map(entry => entry.exercise))).toEqual(['Squat', 'Bench Press', 'Barbell Row']);
  });
});

describe('Sets', () => {
  it('are logged in order, each with its weight, reps and time', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');

    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    clock.setTime('2026-09-12T18:03:00-04:00');
    await tracker.logSet(entry.id, { weight: 62.5, reps: 6 });

    expect(await setsOf(tracker, workout.id)).toEqual([
      {
        id: expect.any(String),
        weight: 60,
        weightUnit: 'kg',
        displayWeight: { value: 60, unit: 'kg' },
        reps: 8,
        isWarmUp: false,
        loggedAt: new Date('2026-09-12T18:00:00-04:00'),
      },
      {
        id: expect.any(String),
        weight: 62.5,
        weightUnit: 'kg',
        displayWeight: { value: 62.5, unit: 'kg' },
        reps: 6,
        isWarmUp: false,
        loggedAt: new Date('2026-09-12T18:03:00-04:00'),
      },
    ]);
  });

  it('keep the weight exactly as entered, in the display unit at that moment', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');

    await tracker.setDisplayUnit('lb');
    await tracker.logSet(entry.id, { weight: 135, reps: 5 });
    await tracker.setDisplayUnit('kg');
    await tracker.logSet(entry.id, { weight: 60, reps: 5 });

    const logged = await setsOf(tracker, workout.id);
    expect(logged.map(set => [set.weight, set.weightUnit])).toEqual([
      [135, 'lb'],
      [60, 'kg'],
    ]);
  });

  it('survive the app closing straight after they are logged', async () => {
    const database = createTestDatabase();
    const tracker = createTracker(database);
    const { workout, entry } = await startWorkoutWith(tracker, 'Deadlift');

    await tracker.logSet(entry.id, { weight: 140, reps: 3 });

    // Another core on the same database, as if the app were reopened.
    const reopened = createTracker(database);
    expect(await setsOf(reopened, workout.id)).toMatchObject([{ weight: 140, reps: 3 }]);
  });

  it('need at least one rep', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');

    await expect(tracker.logSet(entry.id, { weight: 100, reps: 0 })).rejects.toThrow(
      'A Set needs a whole number of reps, at least 1',
    );
  });

  it('need a weight that is a number', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');

    await expect(tracker.logSet(entry.id, { weight: Number.NaN, reps: 5 })).rejects.toThrow(
      "A Set's weight must be a number",
    );
  });

  it('can only be logged for an Exercise in a Workout', async () => {
    const tracker = createTracker(createTestDatabase());

    await expect(tracker.logSet('no-such-entry', { weight: 60, reps: 5 })).rejects.toThrow(
      'No such Exercise in a Workout',
    );
  });

  it('of a weighted Exercise need a weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');

    await expect(tracker.logSet(entry.id, { weight: null, reps: 5 })).rejects.toThrow(
      'A weighted Set needs a weight',
    );
  });

  it("of a weighted Exercise can't have a negative weight", async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');

    await expect(tracker.logSet(entry.id, { weight: -20, reps: 5 })).rejects.toThrow(
      'Only bodyweight Sets can have a negative weight',
    );
  });
});

describe('Bodyweight Sets', () => {
  it('can be plain bodyweight, with no added weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Pull-up');

    await tracker.logSet(entry.id, { weight: null, reps: 8 });

    expect(await setsOf(tracker, workout.id)).toMatchObject([{ weight: null, reps: 8 }]);
  });

  it('keep weight added with a belt or vest as entered, with its unit', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const { workout, entry } = await startWorkoutWith(tracker, 'Dip');

    await tracker.logSet(entry.id, { weight: 25, reps: 6 });

    expect(await setsOf(tracker, workout.id)).toMatchObject([
      { weight: 25, weightUnit: 'lb', reps: 6 },
    ]);
  });

  it('keep the help from an assisted machine as a negative weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Pull-up');

    await tracker.logSet(entry.id, { weight: -20, reps: 10 });

    expect(await setsOf(tracker, workout.id)).toMatchObject([
      { weight: -20, weightUnit: 'kg', reps: 10 },
    ]);
  });
});

describe('Logged Sets', () => {
  it('can be corrected, keeping their place in the order', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    await tracker.logSet(entry.id, { weight: 62.5, reps: 6 });
    const [first] = await setsOf(tracker, workout.id);

    await tracker.editSet(first.id, { weight: 65, reps: 7 });

    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([
      [65, 7],
      [62.5, 6],
    ]);
  });

  it('are corrected in the unit they were logged in, whatever the display unit now', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 135, reps: 5 });
    const [logged] = await setsOf(tracker, workout.id);

    await tracker.setDisplayUnit('kg');
    await tracker.editSet(logged.id, { weight: 140, reps: 5 });

    expect(await setsOf(tracker, workout.id)).toMatchObject([{ weight: 140, weightUnit: 'lb' }]);
  });

  it('follow the same rules when corrected as when logged', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    const [logged] = await setsOf(tracker, workout.id);

    await expect(tracker.editSet(logged.id, { weight: null, reps: 8 })).rejects.toThrow(
      'A weighted Set needs a weight',
    );
    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[60, 8]]);
  });

  it('of a bodyweight Exercise can be corrected to plain bodyweight or to assisted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Pull-up');
    await tracker.logSet(entry.id, { weight: 10, reps: 6 });
    const [logged] = await setsOf(tracker, workout.id);

    await tracker.editSet(logged.id, { weight: null, reps: 6 });
    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[null, 6]]);
    await tracker.editSet(logged.id, { weight: -15, reps: 8 });
    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[-15, 8]]);
  });

  it('can be deleted, leaving the rest in order with new Sets after them', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    await tracker.logSet(entry.id, { weight: 60, reps: 12 });
    await tracker.logSet(entry.id, { weight: 60, reps: 7 });
    const [, typo] = await setsOf(tracker, workout.id);

    await tracker.deleteSet(typo.id);
    await tracker.logSet(entry.id, { weight: 60, reps: 6 });

    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([
      [60, 8],
      [60, 7],
      [60, 6],
    ]);
  });

  it("can't be changed once deleted", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    const [logged] = await setsOf(tracker, workout.id);
    await tracker.deleteSet(logged.id);

    await expect(tracker.editSet(logged.id, { weight: 65, reps: 8 })).rejects.toThrow('No such Set');
    await expect(tracker.deleteSet(logged.id)).rejects.toThrow('No such Set');
  });
});

describe('Same as last set', () => {
  it("logs a copy of the Exercise's previous Set, at the time it's pressed", async () => {
    const clock = clockAt('2026-09-13T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });

    clock.setTime('2026-09-13T18:03:00-04:00');
    await tracker.logSameAsLastSet(entry.id);

    const logged = await setsOf(tracker, workout.id);
    expect(logged.map(set => [set.weight, set.weightUnit, set.reps])).toEqual([
      [60, 'kg', 8],
      [60, 'kg', 8],
    ]);
    expect(logged[1].loggedAt).toEqual(new Date('2026-09-13T18:03:00-04:00'));
  });

  it('copies the last Set still there, not one that was deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    await tracker.logSet(entry.id, { weight: 70, reps: 5 });
    const [, mistake] = await setsOf(tracker, workout.id);
    await tracker.deleteSet(mistake.id);

    await tracker.logSameAsLastSet(entry.id);

    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([
      [60, 8],
      [60, 8],
    ]);
  });

  it('keeps the unit the copied Set was logged in', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 135, reps: 5 });
    await tracker.setDisplayUnit('kg');

    await tracker.logSameAsLastSet(entry.id);

    expect(await setsOf(tracker, workout.id)).toMatchObject([
      { weight: 135, weightUnit: 'lb' },
      { weight: 135, weightUnit: 'lb' },
    ]);
  });

  it('needs a Set to copy', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');

    await expect(tracker.logSameAsLastSet(entry.id)).rejects.toThrow('No Set to copy yet');
  });
});

describe('Warm-up Sets', () => {
  it('are logged as warm-ups when marked so, and as working Sets otherwise', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');

    await tracker.logSet(entry.id, { weight: 40, reps: 10, isWarmUp: true });
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });

    expect((await setsOf(tracker, workout.id)).map(set => set.isWarmUp)).toEqual([true, false]);
  });

  it('can be marked as warm-ups and back when corrected', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 40, reps: 10 });
    const [logged] = await setsOf(tracker, workout.id);
    const warmUps = async () => (await setsOf(tracker, workout.id)).map(set => set.isWarmUp);

    await tracker.editSet(logged.id, { weight: 40, reps: 10, isWarmUp: true });
    expect(await warmUps()).toEqual([true]);
    await tracker.editSet(logged.id, { weight: 40, reps: 10, isWarmUp: false });
    expect(await warmUps()).toEqual([false]);
  });

  it('are copied as warm-ups by "same as last set"', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 40, reps: 10, isWarmUp: true });

    await tracker.logSameAsLastSet(entry.id);

    expect((await setsOf(tracker, workout.id)).map(set => set.isWarmUp)).toEqual([true, true]);
  });
});

describe('Exercises in a Workout', () => {
  it('start with no notes and keep the notes written for them', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Leg Press');
    const notes = async () => (await tracker.getWorkout(workout.id))?.entries.map(e => e.notes);

    expect(await notes()).toEqual(['']);
    await tracker.saveEntryNotes(entry.id, 'Seat on 4, feet high');
    expect(await notes()).toEqual(['Seat on 4, feet high']);
  });

  it('can be removed, leaving the others in order', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, [
      'Squat',
      'Bench Press',
      'Barbell Row',
    ]);
    await tracker.logSet(entries[1].id, { weight: 60, reps: 8 });

    await tracker.removeExerciseFromWorkout(entries[1].id);

    expect(await exerciseNamesOf(tracker, workout.id)).toEqual(['Squat', 'Barbell Row']);
  });

  it('take their Sets with them when removed', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    const [logged] = await setsOf(tracker, workout.id);

    await tracker.removeExerciseFromWorkout(entry.id);

    await expect(tracker.editSet(logged.id, { weight: 65, reps: 8 })).rejects.toThrow('No such Set');
    await expect(tracker.logSet(entry.id, { weight: 60, reps: 8 })).rejects.toThrow(
      'No such Exercise in a Workout',
    );
  });

  it('can be swapped for another Exercise in the same place', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, [
      'Squat',
      'Bench Press',
      'Barbell Row',
    ]);
    const dumbbellBench = await findExerciseByName(tracker, 'Dumbbell Bench Press');

    await tracker.swapExercise(entries[1].id, dumbbellBench.id);

    expect(await exerciseNamesOf(tracker, workout.id)).toEqual([
      'Squat',
      'Dumbbell Bench Press',
      'Barbell Row',
    ]);
  });

  it('keep their notes when swapped, so nothing the lifter wrote is lost', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Leg Press');
    await tracker.saveEntryNotes(entry.id, 'Leg press taken, back in 10 min');
    const squat = await findExerciseByName(tracker, 'Squat');

    await tracker.swapExercise(entry.id, squat.id);

    expect((await tracker.getWorkout(workout.id))?.entries[0].notes).toBe(
      'Leg press taken, back in 10 min',
    );
  });

  it("can't be swapped once a Set is logged for them", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    const dumbbellBench = await findExerciseByName(tracker, 'Dumbbell Bench Press');

    await expect(tracker.swapExercise(entry.id, dumbbellBench.id)).rejects.toThrow(
      "An Exercise with logged Sets can't be swapped",
    );
    expect(await exerciseNamesOf(tracker, workout.id)).toEqual(['Bench Press']);
  });

  it('can be swapped again once their Sets are all deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 8 });
    const [mistake] = await setsOf(tracker, workout.id);
    await tracker.deleteSet(mistake.id);
    const dumbbellBench = await findExerciseByName(tracker, 'Dumbbell Bench Press');

    await tracker.swapExercise(entry.id, dumbbellBench.id);

    expect(await exerciseNamesOf(tracker, workout.id)).toEqual(['Dumbbell Bench Press']);
  });
});

describe('Discarded Workouts', () => {
  it('are no longer in progress and are never found again', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    const [logged] = await setsOf(tracker, workout.id);

    await tracker.discardWorkout(workout.id);

    expect(await tracker.getWorkoutInProgress()).toBeNull();
    expect(await tracker.getWorkout(workout.id)).toBeUndefined();
    await expect(tracker.editSet(logged.id, { weight: 105, reps: 5 })).rejects.toThrow('No such Set');
  });

  it('make way for a new Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const discarded = await tracker.startWorkout();
    await tracker.discardWorkout(discarded.id);

    const next = await tracker.startWorkout();

    expect((await tracker.getWorkoutInProgress())?.id).toBe(next.id);
  });

  it('must still be in progress, so a finished one is never discarded', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);

    await expect(tracker.discardWorkout(workout.id)).rejects.toThrow('That Workout is not in progress');
    expect(await tracker.getWorkout(workout.id)).toBeDefined();
  });

  it("can't be finished afterwards, so they never reach History", async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await tracker.startWorkout();
    await tracker.discardWorkout(workout.id);

    await expect(tracker.finishWorkout(workout.id)).rejects.toThrow('That Workout is not in progress');
  });

  it("can't have Exercises added afterwards", async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await tracker.startWorkout();
    await tracker.discardWorkout(workout.id);
    const squat = await findExerciseByName(tracker, 'Squat');

    await expect(tracker.addExerciseToWorkout(workout.id, squat.id)).rejects.toThrow('No such Workout');
  });
});

async function exerciseNamesOf(tracker: Tracker, workoutId: string) {
  const entries = (await tracker.getWorkout(workoutId))?.entries ?? [];
  return names(entries.map(entry => entry.exercise));
}
