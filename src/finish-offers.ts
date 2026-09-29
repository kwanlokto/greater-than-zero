import { ask, tell, type Question } from '@/ask';
import type { FinishSummary } from '@/core/tracker';
import { tracker } from '@/database';
import { describeTargetWeight } from '@/template-labels';

// After a Workout from a Template finishes, asks about each of its finish
// summary's offers in turn: updating the Template's Exercise list, then raising
// each Target the session beat. Each is accepted or declined on its own;
// declining changes nothing.
export async function askFinishOffers(workoutId: string, summary: FinishSummary) {
  const { templateUpdateOffer, targetUpdateOffers } = summary;
  if (templateUpdateOffer) {
    await offer(
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
    const current = describeTargetWeight(trackingType, targetUpdate.target);
    const proposed = describeTargetWeight(trackingType, targetUpdate);
    await offer(
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
async function offer(question: Question, failureTitle: string, accept: () => Promise<unknown>) {
  if (!(await ask(question))) return;
  try {
    await accept();
  } catch (error) {
    await tell(failureTitle, error instanceof Error ? error.message : String(error));
  }
}
