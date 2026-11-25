import type { Tracker, Workout } from '@/core/tracker';
import { confirmAndRun, runOrTell, type Prompter } from '@/prompter';
import { plannedSetsDropped } from '@/workout-labels';

// Where the lifter lands once a Workout closes: Today, or for a backfilled
// Workout the Day it was added to.
export type Landing = { on: 'today' } | { on: 'day'; localDate: string };

function landingAfter(workout: Pick<Workout, 'isBackfilled' | 'localDate'>): Landing {
  return workout.isBackfilled ? { on: 'day', localDate: workout.localDate } : { on: 'today' };
}

// Finishing the Workout in progress, from the Workout screen, after asking.
// The screen offers it once a Set is logged; before that the core refuses, as
// there's nothing to record. Once it's finished, `closeWorkout` closes the
// screen. Nothing is asked afterwards. Says how it ended.
export async function finishWorkout(
  tracker: Tracker,
  prompter: Prompter,
  workout: Pick<Workout, 'id' | 'entries' | 'isBackfilled' | 'localDate'>,
  closeWorkout: (landing: Landing) => void,
): Promise<'finished' | 'kept'> {
  const finish = await prompter.ask({
    title: 'Finish workout?',
    // Planned Sets never logged go with it, so say so first.
    message: plannedSetsDropped(workout),
    decline: 'Cancel',
    accept: 'Finish',
  });
  if (!finish) return 'kept';
  const finished = await runOrTell(prompter, "Couldn't finish the workout", () =>
    tracker.finishWorkout(workout.id),
  );
  if (!finished) return 'kept';
  closeWorkout(landingAfter(workout));
  return 'finished';
}

// Discarding the Workout in progress, from the Workout screen, after asking.
// A discarded Workout is never recorded, so it won't appear in History. Once
// it's gone, `closeWorkout` closes the screen. Says how it ended.
export async function discardWorkout(
  tracker: Tracker,
  prompter: Prompter,
  workout: Pick<Workout, 'id' | 'isBackfilled' | 'localDate'>,
  closeWorkout: (landing: Landing) => void,
): Promise<'discarded' | 'kept'> {
  const discarded = await confirmAndRun(
    prompter,
    {
      title: 'Discard this workout?',
      message: 'Its exercises and sets will not be saved.',
      decline: 'Keep it',
      accept: 'Discard',
      destructive: true,
    },
    "Couldn't discard the workout",
    () => tracker.discardWorkout(workout.id),
  );
  if (!discarded) return 'kept';
  closeWorkout(landingAfter(workout));
  return 'discarded';
}
