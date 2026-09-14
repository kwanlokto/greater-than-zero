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

describe('A finished Workout', () => {
  it('is edited with the same tools as during a Workout, keeping its date and finished state', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 60, reps: 10 });
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    clock.setTime('2026-09-12T19:00:00-04:00');
    await tracker.finishWorkout(workout.id);
    const [warmUp, working] = await setsOf(tracker, workout.id);

    clock.setTime('2026-09-14T09:00:00-04:00');
    await tracker.editSet(warmUp.id, { weight: 60, reps: 10, isWarmUp: true });
    await tracker.editSet(working.id, { weight: 102.5, reps: 5 });
    await tracker.logSameAsLastSet(entry.id);
    await tracker.saveEntryNotes(entry.id, 'Knees caved on the last one');
    const legPress = await findExerciseByName(tracker, 'Leg Press');
    const added = await tracker.addExerciseToWorkout(workout.id, legPress.id);
    await tracker.logSet(added.id, { weight: 180, reps: 10 });

    expect(await tracker.getWorkout(workout.id)).toMatchObject({
      localDate: '2026-09-12',
      finishedAt: new Date('2026-09-12T19:00:00-04:00'),
      restEndsAt: null,
      entries: [
        {
          exercise: { name: 'Squat' },
          notes: 'Knees caved on the last one',
          sets: [
            { weight: 60, reps: 10, isWarmUp: true },
            { weight: 102.5, reps: 5, isWarmUp: false },
            { weight: 102.5, reps: 5, isWarmUp: false },
          ],
        },
        { exercise: { name: 'Leg Press' }, sets: [{ weight: 180, reps: 10 }] },
      ],
    });
    expect(await tracker.getWorkoutInProgress()).toBeNull();
    expect(await tracker.getTrainingDays('2026-09')).toEqual(['2026-09-12']);
  });

  it('can lose Sets and Exercises while a Set remains', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, ['Squat', 'Leg Press', 'Lunge']);
    await tracker.logSet(entries[0].id, { weight: 100, reps: 5 });
    await tracker.logSet(entries[0].id, { weight: 100, reps: 4 });
    await tracker.logSet(entries[1].id, { weight: 180, reps: 10 });
    await tracker.finishWorkout(workout.id);
    const [, squatTypo] = await setsOf(tracker, workout.id);

    await tracker.deleteSet(squatTypo.id);
    await tracker.removeExerciseFromWorkout(entries[2].id);
    await tracker.removeExerciseFromWorkout(entries[1].id);

    expect(await exerciseNamesOf(tracker, workout.id)).toEqual(['Squat']);
    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[100, 5]]);
  });

  it("keeps its last Set: deleting it is refused, pointing to deleting the Workout", async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    const [only] = await setsOf(tracker, workout.id);

    await expect(tracker.deleteSet(only.id)).rejects.toThrow(
      'A finished Workout keeps at least one Set: delete the Workout instead',
    );
    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[100, 5]]);
  });

  it('keeps its last Sets when the Exercise holding them all would be removed', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, ['Squat', 'Leg Press']);
    await tracker.logSet(entries[0].id, { weight: 100, reps: 5 });
    await tracker.logSet(entries[0].id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(workout.id);

    await expect(tracker.removeExerciseFromWorkout(entries[0].id)).rejects.toThrow(
      'A finished Workout keeps at least one Set: delete the Workout instead',
    );
    expect(await exerciseNamesOf(tracker, workout.id)).toEqual(['Squat', 'Leg Press']);
  });
});

describe('Deleting a finished Workout', () => {
  it('takes it out of History: off the calendar and out of its day', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const workout = await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);

    clock.setTime('2026-09-14T09:00:00-04:00');
    await tracker.deleteWorkout(workout.id);

    expect(await tracker.getTrainingDays('2026-09')).toEqual([]);
    expect((await tracker.getDay('2026-09-12')).workouts).toEqual([]);
    expect(await tracker.getWorkout(workout.id)).toBeUndefined();
  });

  it('leaves "last time" to the session before it', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 8 }]);
    clock.setTime('2026-09-11T18:00:00-04:00');
    const mistake = await doWorkout(tracker, 'Bench Press', [{ weight: 600, reps: 8 }]);

    await tracker.deleteWorkout(mistake.id);
    clock.setTime('2026-09-14T18:00:00-04:00');
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');

    expect(weightsAndReps((await tracker.getLastTime(entry.id))?.sets ?? [])).toEqual([[60, 8]]);
  });

  it('takes its Exercises and Sets with it', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    const [logged] = await setsOf(tracker, workout.id);

    await tracker.deleteWorkout(workout.id);

    await expect(tracker.editSet(logged.id, { weight: 105, reps: 5 })).rejects.toThrow('No such Set');
  });

  it("isn't how a Workout in progress goes: that's discarding", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });

    await expect(tracker.deleteWorkout(workout.id)).rejects.toThrow('No such finished Workout');
    expect((await tracker.getWorkoutInProgress())?.id).toBe(workout.id);
  });
});

describe('A Workout added to a past date', () => {
  it('is recorded on that date, reaching its day in History once finished', async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-14T20:00:00-04:00').now,
    });

    const { workout, entry } = await startWorkoutWith(tracker, 'Squat', { localDate: '2026-09-10' });
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(workout.id);

    expect(await tracker.getTrainingDays('2026-09')).toEqual(['2026-09-10']);
    expect((await tracker.getDay('2026-09-10')).workouts.map(found => found.id)).toEqual([
      workout.id,
    ]);
  });

  it("doesn't start a rest when a Set is logged", async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-14T20:00:00-04:00').now,
    });
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat', { localDate: '2026-09-10' });

    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    await tracker.logSameAsLastSet(entry.id);

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toBeNull();
  });

  it('is told apart from Workouts logged live, even one that ran past midnight', async () => {
    const clock = clockAt('2026-09-12T23:30:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const live = await startWorkoutWith(tracker, 'Squat');
    clock.setTime('2026-09-13T00:15:00-04:00');
    await tracker.logSet(live.entry.id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(live.workout.id);
    clock.setTime('2026-09-14T20:00:00-04:00');
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    const added = await startWorkoutWith(tracker, 'Squat', { localDate: '2026-09-12' });
    await tracker.logSet(added.entry.id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(added.workout.id);

    const backfilledOn = async (localDate: string) =>
      (await tracker.getDay(localDate)).workouts.map(workout => workout.isBackfilled);
    expect(await backfilledOn('2026-09-12')).toEqual([true, false]);
    expect(await backfilledOn('2026-09-14')).toEqual([false]);
  });

  it('sees the session before its date as "last time"', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 8 }]);
    clock.setTime('2026-09-12T18:00:00-04:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 65, reps: 5 }]);

    clock.setTime('2026-09-14T20:00:00-04:00');
    const { entry } = await startWorkoutWith(tracker, 'Bench Press', { localDate: '2026-09-10' });
    const lastTime = await tracker.getLastTime(entry.id);

    expect(lastTime?.localDate).toBe('2026-09-08');
    expect(weightsAndReps(lastTime?.sets ?? [])).toEqual([[60, 8]]);
  });

  it('is "last time" only for later sessions than its date, however recently it was added', async () => {
    const clock = clockAt('2026-09-12T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Bench Press', [{ weight: 65, reps: 5 }]);
    clock.setTime('2026-09-14T20:00:00-04:00');
    const added = await startWorkoutWith(tracker, 'Bench Press', { localDate: '2026-09-10' });
    await tracker.logSet(added.entry.id, { weight: 60, reps: 8 });
    await tracker.finishWorkout(added.workout.id);

    clock.setTime('2026-09-15T18:00:00-04:00');
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');
    const lastTime = await tracker.getLastTime(entry.id);

    expect(lastTime?.localDate).toBe('2026-09-12');
    expect(weightsAndReps(lastTime?.sets ?? [])).toEqual([[65, 5]]);
  });

  it('sees no live session of its own date as "last time", as that may have come later', async () => {
    const clock = clockAt('2026-09-08T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 8 }]);
    clock.setTime('2026-09-10T18:00:00-04:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 65, reps: 5 }]);

    clock.setTime('2026-09-14T20:00:00-04:00');
    const { entry } = await startWorkoutWith(tracker, 'Bench Press', { localDate: '2026-09-10' });

    expect((await tracker.getLastTime(entry.id))?.localDate).toBe('2026-09-08');
  });

  it("comes before its date's live sessions, however recently it was added", async () => {
    const clock = clockAt('2026-09-10T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const live = await doWorkout(tracker, 'Bench Press', [{ weight: 65, reps: 5 }]);
    clock.setTime('2026-09-14T20:00:00-04:00');
    const added = await startWorkoutWith(tracker, 'Bench Press', { localDate: '2026-09-10' });
    await tracker.logSet(added.entry.id, { weight: 60, reps: 8 });
    await tracker.finishWorkout(added.workout.id);

    clock.setTime('2026-09-15T18:00:00-04:00');
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');

    expect(weightsAndReps((await tracker.getLastTime(entry.id))?.sets ?? [])).toEqual([[65, 5]]);
    expect((await tracker.getDay('2026-09-10')).workouts.map(workout => workout.id)).toEqual([
      added.workout.id,
      live.id,
    ]);
  });

  it('follows the one-Workout-at-a-time rule', async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-14T20:00:00-04:00').now,
    });
    await tracker.startWorkout();

    await expect(tracker.startWorkout({ localDate: '2026-09-10' })).rejects.toThrow(
      'A Workout is already in progress',
    );
  });

  it("can't be added to today or a later date", async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-14T20:00:00-04:00').now,
    });

    for (const localDate of ['2026-09-14', '2026-09-15', '2027-01-01']) {
      await expect(tracker.startWorkout({ localDate })).rejects.toThrow(
        'A Workout can only be added to a past date',
      );
    }
    expect(await tracker.getWorkoutInProgress()).toBeNull();
  });

  it('needs a date that exists', async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-14T20:00:00-04:00').now,
    });

    for (const localDate of ['2026-02-30', '2026-9-10', 'yesterday']) {
      await expect(tracker.startWorkout({ localDate })).rejects.toThrow(
        `No such date as ${localDate}`,
      );
    }
  });
});

async function exerciseNamesOf(tracker: Tracker, workoutId: string) {
  const entries = (await tracker.getWorkout(workoutId))?.entries ?? [];
  return names(entries.map(entry => entry.exercise));
}
