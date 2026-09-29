import { createTestDatabase } from './test-database';
import {
  clockAt,
  createRotationWith,
  createTemplateWith,
  doTemplateWorkout,
  doWorkout,
} from './test-helpers';
import { createTracker, type Tracker } from './tracker';

async function nextUpName(tracker: Tracker) {
  return (await tracker.getNextUp())?.name ?? null;
}

describe('Next up', () => {
  it("is the active Rotation's first Template before any Workout", async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);

    await tracker.setActiveRotation(rotation.id);

    const nextUp = await tracker.getNextUp();
    expect(nextUp?.name).toBe('Push');
    expect(nextUp?.exercises.map(({ exercise }) => exercise.name)).toEqual(['Bench Press']);
  });

  it('moves along to the Template after each one done, wrapping around at the end', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push, pull, legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    await doTemplateWorkout(tracker, push.id);
    expect(await nextUpName(tracker)).toBe('Pull');
    await doTemplateWorkout(tracker, pull.id);
    expect(await nextUpName(tracker)).toBe('Legs');
    await doTemplateWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('counts a Workout toward the active Rotation only when started from one of its Templates', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const { template: arms } = await createTemplateWith(tracker, 'Arms', ['Barbell Curl']);
    await tracker.setActiveRotation(rotation.id);

    const fromRotation = await doTemplateWorkout(tracker, push.id);
    const fromOutside = await doTemplateWorkout(tracker, arms.id);
    const empty = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);

    expect((await tracker.getWorkout(fromRotation.workout.id))?.rotationId).toBe(rotation.id);
    expect((await tracker.getWorkout(fromOutside.workout.id))?.rotationId).toBeNull();
    expect((await tracker.getWorkout(empty.id))?.rotationId).toBeNull();
  });

  it('follows a Workout done out of order', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    await doTemplateWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');
    await doTemplateWorkout(tracker, push.id);
    await doTemplateWorkout(tracker, legs.id);
    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('stays put for Workouts started empty or from Templates outside the Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const { template: arms } = await createTemplateWith(tracker, 'Arms', ['Barbell Curl']);
    await tracker.setActiveRotation(rotation.id);
    await doTemplateWorkout(tracker, push.id);

    await doWorkout(tracker, 'Squat', [{ weight: 100, reps: 5 }]);
    await doTemplateWorkout(tracker, arms.id);

    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('goes back to the first Template when the last one done has left the Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [, pull],
      entries: [, pullEntry],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doTemplateWorkout(tracker, pull.id);

    await tracker.removeTemplateFromRotation(pullEntry.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('goes back to the first Template when the last one done has been deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [, pull],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doTemplateWorkout(tracker, pull.id);

    await tracker.deleteTemplate(pull.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('follows the Templates in their current order', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push],
      entries: [, , legsEntry],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doTemplateWorkout(tracker, push.id);

    await tracker.moveTemplateInRotation(legsEntry.id, 1);

    expect(await nextUpName(tracker)).toBe('Legs');
  });

  it('keeps each Rotation where it was when switching the active one', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation: ppl,
      templates: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const {
      rotation: upperLower,
      templates: [upper],
    } = await createRotationWith(tracker, 'Upper Lower', ['Upper', 'Lower']);
    await tracker.setActiveRotation(ppl.id);
    await doTemplateWorkout(tracker, push.id);

    await tracker.setActiveRotation(upperLower.id);
    expect(await nextUpName(tracker)).toBe('Upper');
    await doTemplateWorkout(tracker, upper.id);
    expect(await nextUpName(tracker)).toBe('Lower');

    await tracker.setActiveRotation(ppl.id);
    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('counts only Workouts done under a Rotation toward it, even with a Template it shares', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation: ppl,
      templates: [push, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const pushLegs = await tracker.createRotation('Push Legs');
    await tracker.addTemplateToRotation(pushLegs.id, push.id);
    await tracker.addTemplateToRotation(pushLegs.id, legs.id);
    await tracker.setActiveRotation(pushLegs.id);
    await doTemplateWorkout(tracker, push.id);

    await tracker.setActiveRotation(ppl.id);

    expect(await nextUpName(tracker)).toBe('Push');
  });

  it('counts only finished Workouts still recorded', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push, pull, legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doTemplateWorkout(tracker, push.id);
    const { workout: deleted } = await doTemplateWorkout(tracker, pull.id);
    const discarded = await tracker.startWorkout({ templateId: pull.id });
    await tracker.discardWorkout(discarded.id);

    await tracker.deleteWorkout(deleted.id);
    await tracker.startWorkout({ templateId: legs.id });

    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('goes by the order Workouts go in, so one backfilled afterwards may not be the last', async () => {
    const clock = clockAt('2026-09-28T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const {
      rotation,
      templates: [push, , legs],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);
    await doTemplateWorkout(tracker, push.id);
    clock.setTime('2026-09-29T20:00:00');

    // Onto an earlier date.
    await doTemplateWorkout(tracker, legs.id, { localDate: '2026-09-27' });
    expect(await nextUpName(tracker)).toBe('Pull');

    // Onto the same date, where backfilled Workouts come first.
    await doTemplateWorkout(tracker, legs.id, { localDate: '2026-09-28' });
    expect(await nextUpName(tracker)).toBe('Pull');
  });

  it('is reported on finishing a Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const {
      rotation,
      templates: [push],
    } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    const { template: arms } = await createTemplateWith(tracker, 'Arms', ['Barbell Curl']);
    await tracker.setActiveRotation(rotation.id);

    const afterPush = await doTemplateWorkout(tracker, push.id);
    const afterArms = await doTemplateWorkout(tracker, arms.id);
    await tracker.setActiveRotation(null);
    const afterNoRotation = await doTemplateWorkout(tracker, push.id);

    expect(afterPush.summary.nextUp?.name).toBe('Pull');
    expect(afterArms.summary.nextUp?.name).toBe('Pull');
    expect(afterNoRotation.summary.nextUp).toBeNull();
  });

  it('is nothing with no active Rotation', async () => {
    const tracker = createTracker(createTestDatabase());
    const { templates } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await doTemplateWorkout(tracker, templates[0].id);

    expect(await nextUpName(tracker)).toBeNull();
  });

  it('is nothing once the active Rotation is deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull', 'Legs']);
    await tracker.setActiveRotation(rotation.id);

    await tracker.deleteRotation(rotation.id);

    expect(await nextUpName(tracker)).toBeNull();
  });

  it('is nothing when the active Rotation has no Templates', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, entries } = await createRotationWith(tracker, 'PPL', ['Push']);
    await tracker.setActiveRotation(rotation.id);

    await tracker.removeTemplateFromRotation(entries[0].id);

    expect(await nextUpName(tracker)).toBeNull();
  });
});
