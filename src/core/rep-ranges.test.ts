import { createTestDatabase } from './test-database';
import { findExerciseByName } from './test-helpers';
import { createTracker, problemWithRepRange } from './tracker';

describe("An Exercise's rep range", () => {
  it('is 8–12 until the lifter changes it, for built-in and custom Exercises alike', async () => {
    const tracker = createTracker(createTestDatabase());
    const custom = await tracker.createExercise({
      name: 'Landmine Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    expect(await findExerciseByName(tracker, 'Squat')).toMatchObject({ minReps: 8, maxReps: 12 });
    expect(custom).toMatchObject({ minReps: 8, maxReps: 12 });
  });

  it('can be changed for any Exercise in the library, built-in ones included', async () => {
    const tracker = createTracker(createTestDatabase());
    const squat = await findExerciseByName(tracker, 'Squat');

    await tracker.setExerciseRepRange(squat.id, { minReps: 5, maxReps: 5 });

    expect(await tracker.getExercise(squat.id)).toMatchObject({ minReps: 5, maxReps: 5 });
    expect(await findExerciseByName(tracker, 'Bench Press')).toMatchObject({
      minReps: 8,
      maxReps: 12,
    });
  });

  it.each([
    [{ minReps: 0, maxReps: 5 }, 'A rep range needs whole numbers of reps, at least 1'],
    [{ minReps: 2.5, maxReps: 5 }, 'A rep range needs whole numbers of reps, at least 1'],
    [{ minReps: 8, maxReps: Number.NaN }, 'A rep range needs whole numbers of reps, at least 1'],
    [{ minReps: 12, maxReps: 8 }, "A rep range's minimum can't be more than its maximum"],
  ])('refuses %j', async (repRange, problem) => {
    const tracker = createTracker(createTestDatabase());
    const squat = await findExerciseByName(tracker, 'Squat');

    expect(problemWithRepRange(repRange)).toBe(problem);
    await expect(tracker.setExerciseRepRange(squat.id, repRange)).rejects.toThrow(problem);
    expect(await tracker.getExercise(squat.id)).toMatchObject({ minReps: 8, maxReps: 12 });
  });

  it("can't be changed for an Exercise hidden from the library, or one that isn't there", async () => {
    const tracker = createTracker(createTestDatabase());
    const custom = await tracker.createExercise({
      name: 'Landmine Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await tracker.hideExercise(custom.id);

    await expect(
      tracker.setExerciseRepRange(custom.id, { minReps: 5, maxReps: 8 }),
    ).rejects.toThrow('No such Exercise in the library');
    await expect(
      tracker.setExerciseRepRange('no-such-exercise', { minReps: 5, maxReps: 8 }),
    ).rejects.toThrow('No such Exercise in the library');
  });
});
