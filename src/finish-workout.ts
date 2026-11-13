import {
  canFinishWorkout,
  describeLoad,
  type FinishSummary,
  type Tracker,
  type Workout,
} from '@/core/tracker';
import { messageOf, runOrTell, type Prompter, type Question } from '@/prompter';

// Finishing the Workout in progress, from the Workout screen. With nothing
// logged there's nothing to record, so the way out is discarding it. Once it's
// finished or discarded, `closeWorkout` closes the screen; the offers in the
// finish summary are asked after that, over the screen underneath. Says how it
// ended.
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
  let summary: FinishSummary | undefined;
  const finished = await runOrTell(prompter, "Couldn't finish the workout", async () => {
    summary = await tracker.finishWorkout(workout.id);
  });
  if (!finished || !summary) return 'kept';
  closeWorkout();
  await askFinishOffers(tracker, prompter, workout.id, summary);
  return 'finished';
}

// After a Workout from a Template finishes, asks about each of its finish
// summary's offers in turn: updating the Template's Exercise list, then raising
// each Target the session beat. Each is accepted or declined on its own;
// declining changes nothing.
async function askFinishOffers(
  tracker: Tracker,
  prompter: Prompter,
  workoutId: string,
  summary: FinishSummary,
) {
  const { templateUpdateOffer, targetUpdateOffers } = summary;
  if (templateUpdateOffer) {
    await offer(
      prompter,
      {
        title: `Update ${templateUpdateOffer.templateName}?`,
        message:
          "This workout's exercises differ from it. Exercises it already has keep their targets.",
        decline: 'Keep template',
        accept: 'Update',
      },
      "Couldn't update the template",
      () => tracker.updateTemplateFromWorkout(workoutId),
    );
  }
  for (const targetUpdate of targetUpdateOffers) {
    const { trackingType, name } = targetUpdate.exercise;
    const current = describeLoad(trackingType, targetUpdate.target);
    const proposed = describeLoad(trackingType, targetUpdate);
    await offer(
      prompter,
      {
        title: `Raise the ${name} target?`,
        message: `Every working set beat ${current}. The new target weight would be ${proposed}.`,
        decline: `Keep ${current}`,
        accept: 'Raise',
      },
      "Couldn't raise the target",
      () => tracker.acceptTargetUpdate(workoutId, targetUpdate.templateExerciseId),
    );
  }
}

// Asks the question, and runs `accept` if the lifter accepts. A failure is
// shown until the lifter dismisses it, as a new alert on Android replaces the
// one showing.
async function offer(
  prompter: Prompter,
  question: Question,
  failureTitle: string,
  accept: () => Promise<unknown>,
) {
  if (!(await prompter.ask(question))) return;
  try {
    await accept();
  } catch (error) {
    await prompter.tell(failureTitle, messageOf(error));
  }
}
