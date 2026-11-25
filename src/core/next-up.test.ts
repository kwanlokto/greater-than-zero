import { createTestDatabase } from './test-database';
import {
  clockAt,
  createRotationWith,
  doCategoryWorkout,
  doWorkout,
  startWorkoutWith,
} from './test-helpers';
import { createTracker, type Tracker } from './tracker';

async function nextUpName(tracker: Tracker) {
  return (await tracker.getNextUp())?.name ?? null;
}

describe('Next up', () => {
  it("is the active Rotation's first Category before any Workout in one of them", async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);

    await tracker.setActiveRotation(rotation.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('moves along to the Category after each one done, wrapping around at the end', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push, pull, legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    await doCategoryWorkout(tracker, push.id);
    expect(await nextUpName(tracker)).toBe('Pull');
    await doCategoryWorkout(tracker, pull.id);
    expect(await nextUpName(tracker)).toBe('Legs');
    await doCategoryWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('follows a Workout done out of order', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    await doCategoryWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');
    await doCategoryWorkout(tracker, push.id);
    await doCategoryWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('stays put for Workouts in no Category, or in one outside the Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const arms = await tracker.createCategory('Arms');
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, push.id);

    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    await doCategoryWorkout(tracker, arms.id);

    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('is read from History, so Workouts done before the Rotation was switched on count', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await doCategoryWorkout(tracker, push.id);

    await tracker.setActiveRotation(rotation.id);

    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('counts Workouts done before their Category joined the Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull']);
    const legs = await tracker.createCategory('Legs');
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');

    await tracker.addCategoryToRotation(rotation.id, { id: legs.id });

    // Legs was the last one done, and it's the last in the Rotation.
    expect(await nextUpName(tracker)).toBe('Push');
    await tracker.moveCategoryInRotation(
      (await tracker.getRotation(rotation.id))!.entries[2].id,
      0,
    );
    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('counts a Workout given its Category afterwards', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    const workout = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);
    expect(await nextUpName(tracker)).toBe('Push');

    await tracker.setWorkoutCategory(workout.id, { id: push.id });

    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('goes by the one done before, when the last one done has left the Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push, pull],
      entries: [, pullEntry],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, push.id);
    await doCategoryWorkout(tracker, pull.id);

    await tracker.removeCategoryFromRotation(pullEntry.id);

    // Push is the last one done that's still in it.
    expect(await nextUpName(tracker)).toBe('Legs');
  });

  it('goes back to the first Category when the only one done has been deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [, pull],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, pull.id);

    await tracker.deleteCategory(pull.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('follows the Categories in their current order', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
      entries: [, , legsEntry],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, push.id);

    await tracker.moveCategoryInRotation(legsEntry.id, 1);

    expect(await nextUpName(tracker)).toBe('Legs');
  });

  it('reads the same History whichever Rotation is switched on', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation: ppl,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const {
      rotation: upperLower,
      categories: [upper],
    } = await createRotationWith(tracker, 'Upper Lower', ['Upper', 'Lower']);
    await tracker.setActiveRotation(ppl.id);
    await doCategoryWorkout(tracker, push.id);
    await doCategoryWorkout(tracker, upper.id);

    expect(await nextUpName(tracker)).toBe('Pull');
    await tracker.setActiveRotation(upperLower.id);
    expect(await nextUpName(tracker)).toBe('Lower');
    await tracker.setActiveRotation(ppl.id);
    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('counts a Category two Rotations share toward both', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation: ppl,
      categories: [, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const { rotation: legsFirst } = await createRotationWith(tracker, 'Legs first', ['Upper']);
    await tracker.addCategoryToRotation(legsFirst.id, { id: legs.id });
    await tracker.setActiveRotation(ppl.id);
    await doCategoryWorkout(tracker, legs.id);

    expect(await nextUpName(tracker)).toBe('Push');
    await tracker.setActiveRotation(legsFirst.id);
    expect(await nextUpName(tracker)).toBe('Upper');
  });

  it('counts only finished Workouts still recorded', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push, pull, legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, push.id);
    const { workout: deleted } = await doCategoryWorkout(tracker, pull.id);
    const discarded = await tracker.startWorkout({ categoryId: pull.id });
    await tracker.discardWorkout(discarded.id);

    await tracker.deleteWorkout(deleted.id);
    await tracker.startWorkout({ categoryId: legs.id });

    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('goes by the order Workouts go in, so one backfilled afterwards may not be the last', async () => {
    const clock = clockAt('2026-09-28T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const {
      rotation,
      categories: [push, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, push.id);
    clock.setTime('2026-09-29T20:00:00');

    // Onto an earlier date.
    await doCategoryWorkout(tracker, legs.id, { localDate: '2026-09-27' });
    expect(await nextUpName(tracker)).toBe('Pull');

    // Onto the same date, where backfilled Workouts come first.
    await doCategoryWorkout(tracker, legs.id, { localDate: '2026-09-28' });
    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it("doesn't count a Workout still in progress", async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    const { entry } = await startWorkoutWith(tracker, 'Bench Press', { categoryId: push.id });
    await tracker.logSet(entry.id, { weight: 60, reps: 10 }, 'kg');

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('is nothing with no active Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const { categories } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await doCategoryWorkout(tracker, categories[0].id);

    expect(await nextUpName(tracker)).toBeNull();
  });

  it('is nothing once the active Rotation is deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    await tracker.deleteRotation(rotation.id);

    expect(await nextUpName(tracker)).toBeNull();
  });

  it('is nothing when the active Rotation has no Categories', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, entries } = await createRotationWith(tracker, 'PPL', ['Push']);
    await tracker.setActiveRotation(rotation.id);

    await tracker.removeCategoryFromRotation(entries[0].id);

    expect(await nextUpName(tracker)).toBeNull();
  });
});
