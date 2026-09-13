import { createTestDatabase } from './test-database';
import { findExerciseByName, names } from './test-helpers';
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
    const started = await tracker.startWorkout();

    clock.setTime('2026-09-13T00:45:00-04:00');
    await tracker.finishWorkout(started.id);

    expect(await tracker.getWorkout(started.id)).toMatchObject({
      localDate: '2026-09-12',
      startedAt: new Date('2026-09-12T23:30:00-04:00'),
      finishedAt: new Date('2026-09-13T00:45:00-04:00'),
    });
  });

  it('keep their first finish time if finished again', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const started = await tracker.startWorkout();
    clock.setTime('2026-09-12T19:00:00-04:00');
    await tracker.finishWorkout(started.id);

    clock.setTime('2026-09-12T21:00:00-04:00');
    await expect(tracker.finishWorkout(started.id)).rejects.toThrow('That Workout is not in progress');
    expect((await tracker.getWorkout(started.id))?.finishedAt).toEqual(
      new Date('2026-09-12T19:00:00-04:00'),
    );
  });

  it('are found as the Workout in progress until finished', async () => {
    const tracker = createTracker(createTestDatabase());
    const started = await tracker.startWorkout();

    expect((await tracker.getWorkoutInProgress())?.id).toBe(started.id);
    await tracker.finishWorkout(started.id);
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
    const first = await tracker.startWorkout();
    await tracker.finishWorkout(first.id);

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
        reps: 8,
        loggedAt: new Date('2026-09-12T18:00:00-04:00'),
      },
      {
        id: expect.any(String),
        weight: 62.5,
        weightUnit: 'kg',
        reps: 6,
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

// Starts a Workout with one Exercise in it.
async function startWorkoutWith(tracker: Tracker, exerciseName: string) {
  const workout = await tracker.startWorkout();
  const exercise = await findExerciseByName(tracker, exerciseName);
  const entry = await tracker.addExerciseToWorkout(workout.id, exercise.id);
  return { workout, entry };
}

// The Sets of a Workout's first Exercise.
async function setsOf(tracker: Tracker, workoutId: string) {
  const [entry] = (await tracker.getWorkout(workoutId))?.entries ?? [];
  return entry.sets;
}

// A clock the test moves by hand.
function clockAt(time: string) {
  let current = new Date(time);
  return {
    now: () => current,
    setTime(next: string) {
      current = new Date(next);
    },
  };
}
