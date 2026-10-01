import { createTestDatabase } from './test-database';
import {
  clockAt,
  doWorkout,
  findExerciseByName,
  startWorkoutWith,
  startWorkoutWithEach,
} from './test-helpers';
import { createTracker, type ProgressMeasure, type Tracker } from './tracker';

// An Exercise's progress chart as [local date, value] pairs, values to three
// decimal places.
async function chartOf(tracker: Tracker, exerciseName: string, measure: ProgressMeasure) {
  const exercise = await findExerciseByName(tracker, exerciseName);
  const { points } = await tracker.getProgress(exercise.id, measure);
  return points.map(({ localDate, value }) => [localDate, Math.round(value * 1000) / 1000]);
}

describe('Progress of a weighted Exercise', () => {
  it("charts each finished Workout's best working Set as an estimated one-rep max", async () => {
    const clock = clockAt('2026-09-20T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    // 100 × (1 + 5/30) beats 105 × (1 + 3/30) = 115.5.
    await doWorkout(tracker, 'Bench Press', [
      { weight: 40, reps: 10, isWarmUp: true },
      { weight: 100, reps: 5 },
      { weight: 105, reps: 3 },
    ]);
    clock.setTime('2026-09-22T18:00:00');
    // A single counts as its own weight, 120; 100 × 8 comes to 126.667.
    await doWorkout(tracker, 'Bench Press', [
      { weight: 120, reps: 1 },
      { weight: 100, reps: 8 },
    ]);
    clock.setTime('2026-09-24T18:00:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 130, reps: 1 }]);

    expect(await chartOf(tracker, 'Bench Press', 'estimatedOneRepMax')).toEqual([
      ['2026-09-20', 116.667],
      ['2026-09-22', 126.667],
      ['2026-09-24', 130],
    ]);
  });

  it('switches to the heaviest working weight, leaving out warm-ups and unfinished Workouts', async () => {
    const clock = clockAt('2026-09-20T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkout(tracker, 'Bench Press', [
      { weight: 110, reps: 1, isWarmUp: true },
      { weight: 100, reps: 5 },
      { weight: 105, reps: 3 },
    ]);
    clock.setTime('2026-09-21T18:00:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10, isWarmUp: true }]);
    clock.setTime('2026-09-22T18:00:00');
    const deleted = await doWorkout(tracker, 'Bench Press', [{ weight: 150, reps: 1 }]);
    await tracker.deleteWorkout(deleted.id);
    clock.setTime('2026-09-23T18:00:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 107.5, reps: 2 }]);
    const { entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 140, reps: 1 });

    expect(await chartOf(tracker, 'Bench Press', 'heaviestWeight')).toEqual([
      ['2026-09-20', 105],
      ['2026-09-23', 107.5],
    ]);
  });

  it('shows weights in the display unit, converting each Set from the unit it was entered in', async () => {
    const clock = clockAt('2026-09-20T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setDisplayUnit('lb');
    // 225 lb is 102.058 kg, heavier than 100 kg.
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 225, reps: 5 });
    await tracker.setDisplayUnit('kg');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 });
    await tracker.finishWorkout(workout.id);

    expect(await chartOf(tracker, 'Squat', 'heaviestWeight')).toEqual([['2026-09-20', 102.058]]);
    await tracker.setDisplayUnit('lb');
    expect(await chartOf(tracker, 'Squat', 'heaviestWeight')).toEqual([['2026-09-20', 225]]);
    const squat = await findExerciseByName(tracker, 'Squat');
    expect((await tracker.getProgress(squat.id, 'heaviestWeight')).unit).toBe('lb');
  });

  it('gives a Workout with the Exercise in it twice one point, its best Set', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-20T18:00:00'));
    const { workout, entries } = await startWorkoutWithEach(tracker, [
      'Bench Press',
      'Bench Press',
    ]);
    await tracker.logSet(entries[0].id, { weight: 100, reps: 5 });
    await tracker.logSet(entries[1].id, { weight: 80, reps: 12 });
    await tracker.finishWorkout(workout.id);

    // 80 × (1 + 12/30) = 112, below 116.667.
    expect(await chartOf(tracker, 'Bench Press', 'estimatedOneRepMax')).toEqual([
      ['2026-09-20', 116.667],
    ]);
  });

  it('puts a Workout backfilled onto an earlier date at that date', async () => {
    const clock = clockAt('2026-09-20T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkout(tracker, 'Bench Press', [{ weight: 100, reps: 1 }]);
    clock.setTime('2026-09-25T18:00:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 110, reps: 1 }]);
    // Added after the others, but counting toward the 22nd.
    clock.setTime('2026-09-25T20:00:00');
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press', {
      localDate: '2026-09-22',
    });
    await tracker.logSet(entry.id, { weight: 105, reps: 1 });
    await tracker.finishWorkout(workout.id);

    expect(await chartOf(tracker, 'Bench Press', 'heaviestWeight')).toEqual([
      ['2026-09-20', 100],
      ['2026-09-22', 105],
      ['2026-09-25', 110],
    ]);
  });
});

describe('Progress of a bodyweight Exercise', () => {
  it('charts the most reps in a working Set', async () => {
    const clock = clockAt('2026-09-20T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkout(tracker, 'Pull-up', [
      { weight: null, reps: 15, isWarmUp: true },
      { weight: null, reps: 8 },
      { weight: null, reps: 10 },
    ]);
    clock.setTime('2026-09-22T18:00:00');
    await doWorkout(tracker, 'Pull-up', [
      { weight: -20, reps: 12 },
      { weight: 10, reps: 6 },
    ]);

    expect(await chartOf(tracker, 'Pull-up', 'mostReps')).toEqual([
      ['2026-09-20', 10],
      ['2026-09-22', 12],
    ]);
    const pullUp = await findExerciseByName(tracker, 'Pull-up');
    expect((await tracker.getProgress(pullUp.id, 'mostReps')).unit).toBe('reps');
  });

  it('switches to the heaviest added weight, plain bodyweight counting as none and assistance below it', async () => {
    const clock = clockAt('2026-09-20T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await doWorkout(tracker, 'Pull-up', [
      { weight: -20, reps: 12 },
      { weight: -10, reps: 8 },
    ]);
    clock.setTime('2026-09-21T18:00:00');
    await doWorkout(tracker, 'Pull-up', [
      { weight: null, reps: 8 },
      { weight: -10, reps: 10 },
    ]);
    clock.setTime('2026-09-22T18:00:00');
    await doWorkout(tracker, 'Pull-up', [
      { weight: 0, reps: 9 },
      { weight: 10, reps: 6 },
      { weight: 20, reps: 2, isWarmUp: true },
    ]);
    await tracker.setDisplayUnit('lb');

    expect(await chartOf(tracker, 'Pull-up', 'heaviestWeight')).toEqual([
      ['2026-09-20', -22.046],
      ['2026-09-21', 0],
      ['2026-09-22', 22.046],
    ]);
  });
});

describe('Exercises to chart', () => {
  it('are those with a working Set in a finished Workout, the most recently done first', async () => {
    const clock = clockAt('2026-09-19T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const landmine = await tracker.createExercise({
      name: 'Landmine Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await doWorkout(tracker, 'Landmine Press', [{ weight: 30, reps: 10 }]);
    await tracker.hideExercise(landmine.id);
    clock.setTime('2026-09-20T18:00:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 100, reps: 5 }]);
    clock.setTime('2026-09-21T18:00:00');
    await doWorkout(tracker, 'Squat', [{ weight: 140, reps: 5 }]);
    clock.setTime('2026-09-22T18:00:00');
    await doWorkout(tracker, 'Deadlift', [{ weight: 60, reps: 5, isWarmUp: true }]);
    const { entry } = await startWorkoutWith(tracker, 'Pull-up');
    await tracker.logSet(entry.id, { weight: null, reps: 8 });

    const exercises = await tracker.getProgressExercises();

    expect(exercises.map(exercise => exercise.name)).toEqual([
      'Squat',
      'Bench Press',
      'Landmine Press',
    ]);
  });
});
