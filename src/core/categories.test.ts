import { createTestDatabase } from './test-database';
import {
  createRotationWith,
  doCategoryWorkout,
  doWorkout,
  names,
  startWorkoutWith,
} from './test-helpers';
import { createTracker, type Tracker } from './tracker';

async function categoryNameOf(tracker: Tracker, workoutId: string) {
  return (await tracker.getWorkout(workoutId))?.categoryName;
}

describe('Categories', () => {
  it('are given to a Workout by name, which makes one when there is none called that', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout } = await startWorkoutWith(tracker, 'Bench Press');
    expect(await tracker.getWorkout(workout.id)).toMatchObject({
      categoryId: null,
      categoryName: null,
    });

    await tracker.setWorkoutCategory(workout.id, { name: '  Push ' });

    expect(await categoryNameOf(tracker, workout.id)).toBe('Push');
    expect(names(await tracker.getCategories())).toEqual(['Push']);
  });

  it('are found by name whatever its capitals, rather than made twice', async () => {
    const tracker = createTracker(createTestDatabase());
    const first = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);
    const second = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);
    await tracker.setWorkoutCategory(first.id, { name: 'Push' });

    await tracker.setWorkoutCategory(second.id, { name: 'push' });

    expect(names(await tracker.getCategories())).toEqual(['Push']);
    expect(await categoryNameOf(tracker, second.id)).toBe('Push');
  });

  it('are given to a Workout in progress or a finished one, by picking one there already', async () => {
    const tracker = createTracker(createTestDatabase());
    const pull = await tracker.createCategory('Pull');
    const finished = await doWorkout(tracker, 'Barbell Row', [{ weight: 60, reps: 10 }]);
    const { workout: inProgress } = await startWorkoutWith(tracker, 'Barbell Row');

    await tracker.setWorkoutCategory(finished.id, { id: pull.id });
    await tracker.setWorkoutCategory(inProgress.id, { id: pull.id });

    expect(await categoryNameOf(tracker, finished.id)).toBe('Pull');
    expect(await categoryNameOf(tracker, inProgress.id)).toBe('Pull');
  });

  it('can be taken off a Workout again', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const { workout } = await doCategoryWorkout(tracker, push.id);

    await tracker.setWorkoutCategory(workout.id, null);

    expect(await categoryNameOf(tracker, workout.id)).toBeNull();
    expect(names(await tracker.getCategories())).toEqual(['Push']);
  });

  it("aren't given without a name, to a Workout that isn't there, or from one that isn't", async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout } = await startWorkoutWith(tracker, 'Bench Press');

    await expect(tracker.setWorkoutCategory(workout.id, { name: '  ' })).rejects.toThrow(
      'A Category needs a name',
    );
    await expect(tracker.setWorkoutCategory(workout.id, { id: 'no-such' })).rejects.toThrow(
      'No such Category',
    );
    await expect(tracker.setWorkoutCategory('no-such', { name: 'Push' })).rejects.toThrow(
      'No such Workout',
    );
    // Nothing is left behind by the one that failed.
    expect(await tracker.getCategories()).toEqual([]);
  });

  it('start an empty Workout already in one', async () => {
    const tracker = createTracker(createTestDatabase());
    const legs = await tracker.createCategory('Legs');

    const workout = await tracker.startWorkout({ categoryId: legs.id });

    expect(await tracker.getWorkout(workout.id)).toMatchObject({
      categoryId: legs.id,
      categoryName: 'Legs',
      entries: [],
    });
    await tracker.discardWorkout(workout.id);
    await expect(tracker.startWorkout({ categoryId: 'no-such' })).rejects.toThrow(
      'No such Category',
    );
    expect(await tracker.getWorkoutInProgress()).toBeNull();
  });

  it('are listed by name', async () => {
    const tracker = createTracker(createTestDatabase());
    for (const name of ['pull', 'Legs', 'Push']) await tracker.createCategory(name);

    expect(names(await tracker.getCategories())).toEqual(['Legs', 'pull', 'Push']);
  });

  it('need a name no other Category has', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.createCategory('Push');

    await expect(tracker.createCategory(' ')).rejects.toThrow('A Category needs a name');
    await expect(tracker.createCategory('PUSH')).rejects.toThrow(
      "There's already a Category called Push",
    );
  });

  it('are renamed everywhere at once: on their Workouts and in Rotations', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, categories } = await createRotationWith(tracker, 'PPL', ['Psuh', 'Pull']);
    const { workout } = await doCategoryWorkout(tracker, categories[0].id);

    await tracker.renameCategory(categories[0].id, 'Push');

    expect(await categoryNameOf(tracker, workout.id)).toBe('Push');
    const renamed = await tracker.getRotation(rotation.id);
    expect(renamed?.entries.map(({ category }) => category.name)).toEqual(['Push', 'Pull']);
  });

  it("can't be renamed to a blank name or another Category's, but can change their own capitals", async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('push');
    await tracker.createCategory('Pull');

    await expect(tracker.renameCategory(push.id, ' ')).rejects.toThrow('A Category needs a name');
    await expect(tracker.renameCategory(push.id, 'pull')).rejects.toThrow(
      "There's already a Category called Pull",
    );
    await expect(tracker.renameCategory('no-such', 'Legs')).rejects.toThrow('No such Category');
    await tracker.renameCategory(push.id, 'Push');

    expect(names(await tracker.getCategories())).toEqual(['Pull', 'Push']);
  });

  it('leave their Workouts in History, in no Category, when deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const { workout } = await doCategoryWorkout(tracker, push.id);

    await tracker.deleteCategory(push.id);

    expect(await tracker.getCategories()).toEqual([]);
    expect(await tracker.getWorkout(workout.id)).toMatchObject({
      categoryId: null,
      categoryName: null,
      entries: [{ sets: [{ weight: 60, reps: 10 }] }],
    });
    await expect(tracker.deleteCategory(push.id)).rejects.toThrow('No such Category');
  });

  it('leave every Rotation when deleted, and free their name', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, categories } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull']);

    await tracker.deleteCategory(categories[0].id);

    const left = await tracker.getRotation(rotation.id);
    expect(left?.entries.map(({ category }) => category.name)).toEqual(['Pull']);
    expect(await tracker.createCategory('Push')).toMatchObject({ name: 'Push' });
  });
});
