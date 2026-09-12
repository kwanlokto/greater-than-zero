import { createTestDatabase } from './test-database';
import { createTracker } from './tracker';

function names(exercises: { name: string }[]) {
  return exercises.map(exercise => exercise.name);
}

describe('Exercise library', () => {
  it('finds Exercises whose name contains the search, ignoring case', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ name: 'BENCH' });

    expect(names(found)).toEqual([
      'Bench Press',
      'Close-Grip Bench Press',
      'Dumbbell Bench Press',
      'Incline Bench Press',
    ]);
  });

  it('matches every word of the search, in any order', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ name: 'press incline' });

    expect(names(found)).toEqual(['Incline Bench Press', 'Incline Dumbbell Press']);
  });

  it('filters by main muscle group', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ muscleGroup: 'hamstrings' });

    expect(names(found)).toEqual(['Leg Curl', 'Romanian Deadlift']);
  });

  it('applies the search and the muscle-group filter together', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ name: 'curl', muscleGroup: 'biceps' });

    expect(names(found)).toEqual(['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl']);
  });

  it('lists the whole library in name order when the search is blank and no filter is set', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ name: '  ' });

    expect(found).toHaveLength(41);
    expect(names(found).slice(0, 3)).toEqual(['Ab Wheel Rollout', 'Barbell Curl', 'Barbell Row']);
  });

  it('describes each Exercise by its name, tracking type and main muscle group', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ name: 'pull-up' });

    expect(found).toEqual([
      { id: expect.any(String), name: 'Pull-up', trackingType: 'bodyweight', muscleGroup: 'back' },
    ]);
  });

  it('gives every built-in Exercise the same ID on every install', async () => {
    const firstInstall = createTracker(createTestDatabase());
    const secondInstall = createTracker(createTestDatabase());

    expect(await secondInstall.searchExercises({})).toEqual(await firstInstall.searchExercises({}));
  });

  it('keeps the ID of a built-in Exercise from one app version to the next', async () => {
    const tracker = createTracker(createTestDatabase());

    const found = await tracker.searchExercises({ name: 'Bench Press' });
    const benchPress = found.find(exercise => exercise.name === 'Bench Press');

    // Backup files from every earlier version refer to this ID.
    expect(benchPress?.id).toBe('727a98e3-704c-4027-8be1-9a2b89dec956');
  });
});
