import { createTestDatabase } from './test-database';
import { findExerciseByName, names } from './test-helpers';
import { createTracker } from './tracker';

describe('Custom Exercises', () => {
  it('appear in search and filters once created', async () => {
    const tracker = createTracker(createTestDatabase());

    const created = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    expect(await tracker.searchExercises({ query: 'arnold', muscleGroup: 'shoulders' })).toEqual([
      {
        id: created.id,
        name: 'Arnold Press',
        trackingType: 'weighted',
        muscleGroup: 'shoulders',
        isCustom: true,
      },
    ]);
  });

  it('sort among the built-ins by name, ignoring case', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.createExercise({
      name: 'arnold press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    const found = await tracker.searchExercises({ query: 'press', muscleGroup: 'shoulders' });

    expect(names(found)).toEqual(['arnold press', 'Dumbbell Shoulder Press', 'Overhead Press']);
  });

  it('are named without the spaces typed around the name', async () => {
    const tracker = createTracker(createTestDatabase());

    const created = await tracker.createExercise({
      name: '  Arnold Press ',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    expect(created.name).toBe('Arnold Press');
  });

  it('need a name', async () => {
    const tracker = createTracker(createTestDatabase());

    await expect(
      tracker.createExercise({ name: '   ', trackingType: 'weighted', muscleGroup: 'shoulders' }),
    ).rejects.toThrow('An Exercise needs a name');
  });

  it('can be renamed and moved to another muscle group, keeping their tracking type', async () => {
    const tracker = createTracker(createTestDatabase());
    const created = await tracker.createExercise({
      name: 'Landmine Press',
      trackingType: 'weighted',
      muscleGroup: 'chest',
    });

    await tracker.editExercise(created.id, { name: 'Half-kneeling Landmine Press', muscleGroup: 'shoulders' });

    expect(await tracker.getExercise(created.id)).toEqual({
      id: created.id,
      name: 'Half-kneeling Landmine Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
      isCustom: true,
    });
  });

  it("can't be renamed to a blank name", async () => {
    const tracker = createTracker(createTestDatabase());
    const created = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    await expect(
      tracker.editExercise(created.id, { name: ' ', muscleGroup: 'shoulders' }),
    ).rejects.toThrow('An Exercise needs a name');
    expect(await tracker.getExercise(created.id)).toEqual(created);
  });

  it('disappear from the library once hidden', async () => {
    const tracker = createTracker(createTestDatabase());
    const created = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    await tracker.hideExercise(created.id);

    expect(names(await tracker.searchExercises({ query: 'arnold' }))).toEqual([]);
  });

  it('can still be looked up by ID once hidden, so history keeps their name', async () => {
    const tracker = createTracker(createTestDatabase());
    const created = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });

    await tracker.hideExercise(created.id);

    expect((await tracker.getExercise(created.id))?.name).toBe('Arnold Press');
  });

  it("can't be edited once hidden, so history keeps the name they had", async () => {
    const tracker = createTracker(createTestDatabase());
    const created = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await tracker.hideExercise(created.id);

    await expect(
      tracker.editExercise(created.id, { name: 'Renamed', muscleGroup: 'shoulders' }),
    ).rejects.toThrow('Only custom Exercises in the library can be changed');
    expect((await tracker.getExercise(created.id))?.name).toBe('Arnold Press');
  });
});

describe('Built-in Exercises', () => {
  it("can't be edited", async () => {
    const tracker = createTracker(createTestDatabase());
    const benchPress = await findExerciseByName(tracker, 'Bench Press');

    await expect(
      tracker.editExercise(benchPress.id, { name: 'Flat Bench', muscleGroup: 'triceps' }),
    ).rejects.toThrow('Only custom Exercises in the library can be changed');
    expect(await tracker.getExercise(benchPress.id)).toEqual(benchPress);
  });

  it("can't be hidden", async () => {
    const tracker = createTracker(createTestDatabase());
    const benchPress = await findExerciseByName(tracker, 'Bench Press');

    await expect(tracker.hideExercise(benchPress.id)).rejects.toThrow(
      'Only custom Exercises in the library can be changed',
    );
    expect(names(await tracker.searchExercises({ muscleGroup: 'chest' }))).toContain('Bench Press');
  });
});
