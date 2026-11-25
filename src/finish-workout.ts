import { canFinishWorkout, type Tracker, type Workout } from '@/core/tracker';
import { runOrTell, type Prompter } from '@/prompter';

// Finishing the Workout in progress, from the Workout screen. With nothing
// logged there's nothing to record, so the way out is discarding it. Once it's
// finished or discarded, `closeWorkout` closes the screen. Nothing is asked
// afterwards. Says how it ended.
export async function finishWorkout(
  tracker: Tracker,
  prompter: Prompter,
  workout: Pick<Workout, 'id' | 'entries'>,
  closeWorkout: () => void,
): Promise<'finished' | 'discarded' | 'kept'> {
  if (!canFinishWorkout(workout)) {
    const discard = await prompter.ask({
      title: 'No sets logged yet',
      message: 'Log a set to finish this workout, or discard it.',
      decline: 'Keep going',
      accept: 'Discard',
      destructive: true,
    });
    if (!discard) return 'kept';
    // A discarded Workout is never recorded, so it won't appear in History.
    const discarded = await runOrTell(prompter, "Couldn't discard the workout", () =>
      tracker.discardWorkout(workout.id),
    );
    if (!discarded) return 'kept';
    closeWorkout();
    return 'discarded';
  }
  const finish = await prompter.ask({
    title: 'Finish workout?',
    decline: 'Cancel',
    accept: 'Finish',
  });
  if (!finish) return 'kept';
  const finished = await runOrTell(prompter, "Couldn't finish the workout", () =>
    tracker.finishWorkout(workout.id),
  );
  if (!finished) return 'kept';
  closeWorkout();
  return 'finished';
}
