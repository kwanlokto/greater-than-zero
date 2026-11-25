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
  it("is the active Rotation's first Category before any Workout", async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);

    await tracker.setActiveRotation(rotation.id);

    const nextUp = await tracker.getNextUp();
    expect(nextUp?.name).toBe('Push');
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

  it('counts a Workout toward the active Rotation only when started from one of its Categories', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const arms = await tracker.createCategory('Arms');
    await tracker.setActiveRotation(rotation.id);

    const fromRotation = await doCategoryWorkout(tracker, push.id);
    const fromOutside = await doCategoryWorkout(tracker, arms.id);
    const empty = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);

    expect((await tracker.getWorkout(fromRotation.workout.id))?.rotationId).toBe(rotation.id);
    expect((await tracker.getWorkout(fromOutside.workout.id))?.rotationId).toBeNull();
    expect((await tracker.getWorkout(empty.id))?.rotationId).toBeNull();
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

  it('stays put for Workouts started empty or from Categories outside the Rotation', async () => {
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

  it('goes back to the first Category when the last one done has left the Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [, pull],
      entries: [, pullEntry],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doCategoryWorkout(tracker, pull.id);

    await tracker.removeCategoryFromRotation(pullEntry.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('goes back to the first Category when the last one done has been deleted', async () => {
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

  it('keeps each Rotation where it was when switching the active one', async () => {
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

    await tracker.setActiveRotation(upperLower.id);
    expect(await nextUpName(tracker)).toBe('Upper');
    await doCategoryWorkout(tracker, upper.id);
    expect(await nextUpName(tracker)).toBe('Lower');

    await tracker.setActiveRotation(ppl.id);
    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('counts only Workouts done under a Rotation toward it, even with a Category it shares', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation: ppl,
      categories: [push, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const pushLegs = await tracker.createRotation('Push Legs');
    await tracker.addCategoryToRotation(pushLegs.id, push.id);
    await tracker.addCategoryToRotation(pushLegs.id, legs.id);
    await tracker.setActiveRotation(pushLegs.id);
    await doCategoryWorkout(tracker, push.id);

    await tracker.setActiveRotation(ppl.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('counts a Workout toward the Rotation active when it started, whatever is active at finish', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation: ppl,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const { rotation: upperLower } = await createRotationWith(tracker, 'Upper Lower', [
      'Upper',
      'Lower',
    ]);
    await tracker.setActiveRotation(ppl.id);
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press', {
      categoryId: push.id,
    });
    await tracker.logSet(entry.id, { weight: 60, reps: 10 }, 'kg');

    await tracker.setActiveRotation(upperLower.id);
    await tracker.finishWorkout(workout.id);

    expect(await nextUpName(tracker)).toBe('Upper');
    await tracker.setActiveRotation(ppl.id);
    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it("doesn't count Workouts done before their Category was in the active Rotation", async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await doCategoryWorkout(tracker, push.id);

    await tracker.setActiveRotation(rotation.id);

    expect(await nextUpName(tracker)).toBe('Push');
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

  it('is reported on finishing a Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      categories: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const arms = await tracker.createCategory('Arms');
    await tracker.setActiveRotation(rotation.id);

    const afterPush = await doCategoryWorkout(tracker, push.id);
    const afterArms = await doCategoryWorkout(tracker, arms.id);
    await tracker.setActiveRotation(null);
    const afterNoRotation = await doCategoryWorkout(tracker, push.id);

    expect(afterPush.summary.nextUp?.name).toBe('Pull');
    expect(afterArms.summary.nextUp?.name).toBe('Pull');
    expect(afterNoRotation.summary.nextUp).toBeNull();
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
