import { createTestDatabase } from '@/core/test-database';
import { clockAt, doWorkout, startWorkoutWith } from '@/core/test-helpers';
import { createTracker, type Tracker } from '@/core/tracker';
import { discardWorkout, finishWorkout } from '@/leave-workout';
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
  it("never offers to discard instead: with nothing logged, the core's refusal is told", async () => {
    const tracker = createTracker(createTestDatabase());
    await startWorkoutWith(tracker, 'Squat');
    const { prompter, asked, told } = scriptedPrompter([true]);
    const closeWorkout = jest.fn();

    expect(
      await finishWorkout(tracker, prompter, await workoutInProgress(tracker), closeWorkout),
    ).toBe('kept');
    expect(asked.map(question => question.title)).toEqual(['Finish workout?']);
    expect(told).toEqual([
      {
        title: "Couldn't finish the workout",
        message: 'A Workout needs at least one Set to be finished',
      },
    ]);
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
    // With no planned Sets left, the question says it all.
    expect(asked).toEqual([expect.objectContaining({ title: 'Finish workout?', message: undefined })]);
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

  it('says first how many planned Sets were never logged, as finishing drops them', async () => {
    const tracker = createTracker(createTestDatabase());
    const set = { weight: 100, reps: 5 };
    const done = await doWorkout(tracker, 'Squat', [set, set, set]);
    await tracker.startWorkout({ repeatOf: done.id });
    const [first] = (await workoutInProgress(tracker)).entries[0].plannedSets;
    await tracker.confirmPlannedSet(first.id, set);
    const { prompter, asked } = scriptedPrompter([true]);

    await finishWorkout(tracker, prompter, await workoutInProgress(tracker), jest.fn());

    expect(asked).toEqual([
      expect.objectContaining({
        title: 'Finish workout?',
        message: "2 planned sets weren't logged and will be dropped.",
      }),
    ]);
  });

  it('lands on Today once finished', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const closeWorkout = jest.fn();

    await finishWorkout(
      tracker,
      scriptedPrompter([true]).prompter,
      await workoutInProgress(tracker),
      closeWorkout,
    );

    expect(closeWorkout).toHaveBeenCalledWith({ on: 'today' });
  });

  it('lands a backfilled Workout on the Day it was added to', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-11-20T18:00:00'));
    const { entry } = await startWorkoutWith(tracker, 'Squat', { localDate: '2026-11-16' });
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const closeWorkout = jest.fn();

    await finishWorkout(
      tracker,
      scriptedPrompter([true]).prompter,
      await workoutInProgress(tracker),
      closeWorkout,
    );

    expect(closeWorkout).toHaveBeenCalledWith({ on: 'day', localDate: '2026-11-16' });
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

describe('Discarding a Workout', () => {
  it('asks first, and keeps the Workout when the lifter declines', async () => {
    const tracker = createTracker(createTestDatabase());
    const { entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const { prompter, asked } = scriptedPrompter([false]);
    const closeWorkout = jest.fn();

    expect(
      await discardWorkout(tracker, prompter, await workoutInProgress(tracker), closeWorkout),
    ).toBe('kept');
    expect(asked.map(question => question.title)).toEqual(['Discard this workout?']);
    expect(closeWorkout).not.toHaveBeenCalled();
    expect(await tracker.getWorkoutInProgress()).not.toBeNull();
  });

  it('discards it when the lifter agrees, and lands on Today', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Squat');
    await tracker.logSet(entry.id, { weight: 100, reps: 5 }, 'kg');
    const { prompter } = scriptedPrompter([true]);
    const closeWorkout = jest.fn();

    expect(
      await discardWorkout(tracker, prompter, await workoutInProgress(tracker), closeWorkout),
    ).toBe('discarded');
    expect(closeWorkout).toHaveBeenCalledWith({ on: 'today' });
    expect(await tracker.getWorkoutInProgress()).toBeNull();
    // Never recorded: it isn't a finished Workout either.
    expect(await tracker.getWorkout(workout.id)).toBeUndefined();
  });

  it('lands a discarded backfill on the Day it was being added to', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-11-20T18:00:00'));
    await startWorkoutWith(tracker, 'Squat', { localDate: '2026-11-16' });
    const closeWorkout = jest.fn();

    await discardWorkout(
      tracker,
      scriptedPrompter([true]).prompter,
      await workoutInProgress(tracker),
      closeWorkout,
    );

    expect(closeWorkout).toHaveBeenCalledWith({ on: 'day', localDate: '2026-11-16' });
  });

  it("tells the lifter why it couldn't discard, and leaves the Workout open", async () => {
    const tracker = createTracker(createTestDatabase());
    await startWorkoutWith(tracker, 'Squat');
    const workout = await workoutInProgress(tracker);
    // Discarded meanwhile, e.g. by a second tap.
    await tracker.discardWorkout(workout.id);
    const { prompter, told } = scriptedPrompter([true]);
    const closeWorkout = jest.fn();

    expect(await discardWorkout(tracker, prompter, workout, closeWorkout)).toBe('kept');
    expect(told.map(({ title }) => title)).toEqual(["Couldn't discard the workout"]);
    expect(closeWorkout).not.toHaveBeenCalled();
  });
});
