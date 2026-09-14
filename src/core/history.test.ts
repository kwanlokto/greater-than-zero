import { createTestDatabase } from './test-database';
import { clockAt, doWorkout, startWorkoutWith, startWorkoutWithEach } from './test-helpers';
import { createTracker } from './tracker';

describe('Training days', () => {
  it('are the local dates in the month with a finished Workout, each listed once', async () => {
    const clock = clockAt('2026-08-31T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    for (const time of [
      '2026-09-03T18:00:00-04:00',
      '2026-09-12T07:00:00-04:00',
      '2026-09-12T18:00:00-04:00',
      '2026-10-01T18:00:00-04:00',
    ]) {
      clock.setTime(time);
      await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 8 }]);
    }

    expect(await tracker.getTrainingDays('2026-09')).toEqual(['2026-09-03', '2026-09-12']);
  });

  it("don't include today until its Workout is finished", async () => {
    const clock = clockAt('2026-09-14T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });

    expect(await tracker.getTrainingDays('2026-09')).toEqual([]);
    await tracker.finishWorkout(workout.id);
    expect(await tracker.getTrainingDays('2026-09')).toEqual(['2026-09-14']);
  });

  it('never include a discarded Workout', async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-14T18:00:00-04:00').now,
    });
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });

    await tracker.discardWorkout(workout.id);

    expect(await tracker.getTrainingDays('2026-09')).toEqual([]);
  });

  it('count a late-night Workout toward the day it started, even in the month before', async () => {
    const clock = clockAt('2026-09-30T23:30:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const { workout, entry } = await startWorkoutWith(tracker, 'Deadlift');
    await tracker.logSet(entry.id, { weight: 140, reps: 3 });
    clock.setTime('2026-10-01T00:45:00-04:00');
    await tracker.finishWorkout(workout.id);

    expect(await tracker.getTrainingDays('2026-09')).toEqual(['2026-09-30']);
    expect(await tracker.getTrainingDays('2026-10')).toEqual([]);
  });
});

describe('A day', () => {
  it('lists its finished Workouts in the order they started, with their Exercises, notes and Sets', async () => {
    const clock = clockAt('2026-09-12T07:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    const morning = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(morning.entry.id, { weight: 60, reps: 10, isWarmUp: true });
    await tracker.logSet(morning.entry.id, { weight: 100, reps: 5 });
    await tracker.saveEntryNotes(morning.entry.id, 'Belt on');
    clock.setTime('2026-09-12T08:00:00-04:00');
    await tracker.finishWorkout(morning.workout.id);
    clock.setTime('2026-09-12T18:00:00-04:00');
    const evening = await startWorkoutWithEach(tracker, ['Bench Press', 'Pull-up']);
    await tracker.logSet(evening.entries[0].id, { weight: 60, reps: 8 });
    await tracker.logSet(evening.entries[1].id, { weight: null, reps: 8 });
    clock.setTime('2026-09-12T19:00:00-04:00');
    await tracker.finishWorkout(evening.workout.id);

    expect(await tracker.getDay('2026-09-12')).toMatchObject({
      localDate: '2026-09-12',
      workouts: [
        {
          id: morning.workout.id,
          startedAt: new Date('2026-09-12T07:00:00-04:00'),
          finishedAt: new Date('2026-09-12T08:00:00-04:00'),
          entries: [
            {
              exercise: { name: 'Squat' },
              notes: 'Belt on',
              sets: [
                { weight: 60, reps: 10, isWarmUp: true },
                { weight: 100, reps: 5, isWarmUp: false },
              ],
            },
          ],
        },
        {
          id: evening.workout.id,
          startedAt: new Date('2026-09-12T18:00:00-04:00'),
          finishedAt: new Date('2026-09-12T19:00:00-04:00'),
          entries: [
            { exercise: { name: 'Bench Press' }, notes: '', sets: [{ weight: 60, reps: 8 }] },
            { exercise: { name: 'Pull-up' }, notes: '', sets: [{ weight: null, reps: 8 }] },
          ],
        },
      ],
    });
  });

  it("leaves out other days' Workouts, the one in progress and discarded ones", async () => {
    const clock = clockAt('2026-09-11T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), { now: clock.now });
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    clock.setTime('2026-09-12T07:00:00-04:00');
    const { workout: recorded, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(recorded.id);
    clock.setTime('2026-09-12T12:00:00-04:00');
    const discarded = await tracker.startWorkout();
    await tracker.discardWorkout(discarded.id);
    clock.setTime('2026-09-12T18:00:00-04:00');
    await startWorkoutWith(tracker, 'Bench Press');

    const day = await tracker.getDay('2026-09-12');

    expect(day.workouts.map(workout => workout.id)).toEqual([recorded.id]);
  });

  it('shows weights in the display unit, whatever unit they were logged in', async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-12T18:00:00-04:00').now,
    });
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);

    await tracker.setDisplayUnit('lb');
    const [workout] = (await tracker.getDay('2026-09-12')).workouts;

    expect(workout.entries[0].sets).toMatchObject([
      { weight: 100, weightUnit: 'kg', displayWeight: { value: 220.5, unit: 'lb' } },
    ]);
  });

  it('has no Workouts when there was no training that day', async () => {
    const tracker = createTracker(createTestDatabase(), {
      now: clockAt('2026-09-12T18:00:00-04:00').now,
    });
    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);

    expect(await tracker.getDay('2026-09-13')).toEqual({ localDate: '2026-09-13', workouts: [] });
  });
});
