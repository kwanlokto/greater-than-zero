import { createTestDatabase } from '@/core/test-database';
import { startWorkoutWith } from '@/core/test-helpers';
import { createTracker, type Tracker } from '@/core/tracker';
import { finishWorkout } from '@/finish-workout';
import type { Prompter } from '@/prompter';
import { scriptedPrompter } from '@/scripted-prompter';

async function workoutInProgress(tracker: Tracker) {
  const workout = await tracker.getWorkoutInProgress();
  if (!workout) throw new Error('No Workout in progress');
  return workout;
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

  it('closes the Workout once finished, and asks nothing more', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const events: string[] = [];
    const { prompter } = scriptedPrompter([true]);

    const ended = await finishWorkout(
      tracker,
      recording(prompter, events),
      await workoutInProgress(tracker),
      () => events.push('closed'),
    );

    expect(ended).toBe('finished');
    expect(events).toEqual(['Finish workout?', 'closed']);
    expect(await tracker.getWorkoutInProgress()).toBeNull();
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
