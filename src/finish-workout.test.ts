import { createTestDatabase } from '@/core/test-database';
import {
  createTemplateWith,
  findExerciseByName,
  startWorkoutWith,
  targetsOf,
} from '@/core/test-helpers';
import { createTracker, type Tracker } from '@/core/tracker';
import { finishWorkout } from '@/finish-workout';
import type { Prompter } from '@/prompter';
import { scriptedPrompter } from '@/scripted-prompter';

async function workoutInProgress(tracker: Tracker) {
  const workout = await tracker.getWorkoutInProgress();
  if (!workout) throw new Error('No Workout in progress');
  return workout;
}

// The Push Template's Bench Press done heavier than its Target (3 × 8–12 @
// 60 kg), with Dip added: a Workout that offers both to update the Template
// and to raise the Target.
async function pushWorkoutWithOffers(tracker: Tracker) {
  const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
  await tracker.startWorkout({ templateId: template.id });
  const [bench] = (await workoutInProgress(tracker)).entries;
  for (const planned of bench.plannedSets) {
    await tracker.confirmPlannedSet(planned.id, { weight: 62.5, reps: 8 });
  }
  const dip = await findExerciseByName(tracker, 'Dip');
  const workout = await workoutInProgress(tracker);
  const added = await tracker.addExerciseToWorkout(workout.id, dip.id);
  await tracker.logSet(added.id, { weight: null, reps: 10 }, 'kg');
  return { template, workout: await workoutInProgress(tracker) };
}

// What happened, in order: each question asked, and the Workout closing.
function recording(prompter: Prompter, events: string[]): Prompter {
  return {
    ask: question => {
      events.push(question.title);
      return prompter.ask(question);
    },
    tell: prompter.tell,
  };
}

describe('Finishing a Workout', () => {
  it('offers to discard one with nothing logged, and discards it when the lifter agrees', async () => {
    const tracker = createTracker(createTestDatabase());
    await startWorkoutWith(tracker, 'Squat');
    const { prompter, asked } = scriptedPrompter([true]);
    const closeWorkout = jest.fn();

    const ended = await finishWorkout(
      tracker,
      prompter,
      await workoutInProgress(tracker),
      closeWorkout,
    );

    expect(ended).toBe('discarded');
    expect(asked.map(question => question.title)).toEqual(['No sets logged yet']);
    expect(closeWorkout).toHaveBeenCalledTimes(1);
    expect(await tracker.getWorkoutInProgress()).toBeNull();
  });

  it('keeps one with nothing logged when the lifter keeps going', async () => {
    const tracker = createTracker(createTestDatabase());
    await startWorkoutWith(tracker, 'Squat');
    const { prompter } = scriptedPrompter([false]);
    const closeWorkout = jest.fn();

    expect(
      await finishWorkout(tracker, prompter, await workoutInProgress(tracker), closeWorkout),
    ).toBe('kept');
    expect(closeWorkout).not.toHaveBeenCalled();
    expect(await tracker.getWorkoutInProgress()).not.toBeNull();
  });

  it('asks first, and leaves it in progress when the lifter cancels', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const { prompter, asked } = scriptedPrompter([false]);

    expect(
      await finishWorkout(tracker, prompter, await workoutInProgress(tracker), jest.fn()),
    ).toBe('kept');
    expect(asked.map(question => question.title)).toEqual(['Finish workout?']);
    expect(await tracker.getWorkoutInProgress()).not.toBeNull();
  });

  it('closes the Workout once finished, then asks about each offer in turn', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, workout } = await pushWorkoutWithOffers(tracker);
    const events: string[] = [];
    const { prompter } = scriptedPrompter([true, true, true]);

    const ended = await finishWorkout(tracker, recording(prompter, events), workout, () =>
      events.push('closed'),
    );

    expect(ended).toBe('finished');
    expect(events).toEqual([
      'Finish workout?',
      'closed',
      'Update Push?',
      'Raise the Bench Press target?',
    ]);
    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Bench Press', 3, 8, 12, 62.5, 'kg'],
      ['Dip', 1, 10, 10, null, 'kg'],
    ]);
  });

  it('changes nothing for an offer the lifter declines', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, workout } = await pushWorkoutWithOffers(tracker);
    const { prompter } = scriptedPrompter([true, false, false]);

    await finishWorkout(tracker, prompter, workout, jest.fn());

    expect(await targetsOf(tracker, template.id)).toEqual([['Bench Press', 3, 8, 12, 60, 'kg']]);
  });

  it("tells the lifter why it couldn't finish, and leaves the Workout open", async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const workout = await workoutInProgress(tracker);
    // Finished meanwhile, e.g. by a second tap.
    await tracker.finishWorkout(workout.id);
    const { prompter, told } = scriptedPrompter([true]);
    const closeWorkout = jest.fn();

    expect(await finishWorkout(tracker, prompter, workout, closeWorkout)).toBe('kept');
    expect(told).toEqual([
      { title: "Couldn't finish the workout", message: 'That Workout is not in progress' },
    ]);
    expect(closeWorkout).not.toHaveBeenCalled();
  });
});
