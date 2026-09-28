import { Alert } from 'react-native';

import type { FinishSummary } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { describeTargetWeight } from '@/template-labels';

// After a Workout from a Template finishes, puts each of its finish summary's
// offers to the lifter in turn: updating the Template's Exercise list, then
// raising each Target the session beat. Each is accepted or declined on its
// own; declining changes nothing.
export async function putFinishOffers(workoutId: string, summary: FinishSummary) {
  const { templateUpdateOffer, targetUpdateOffers } = summary;
  if (
    templateUpdateOffer &&
    (await ask(
      `Update ${templateUpdateOffer.templateName}?`,
      "This workout's exercises differ from it. Exercises it already has keep their targets.",
      'Keep template',
      'Update',
    ))
  ) {
    await runOrAlert("Couldn't update the template", () =>
      tracker.updateTemplateFromWorkout(workoutId),
    );
  }
  for (const offer of targetUpdateOffers) {
    const { trackingType, name } = offer.exercise;
    const current = describeTargetWeight(trackingType, offer.target);
    const proposed = describeTargetWeight(trackingType, offer);
    if (
      await ask(
        `Raise the ${name} target?`,
        `Every working set beat ${current}. The new target weight would be ${proposed}.`,
        `Keep ${current}`,
        'Raise',
      )
    ) {
      await runOrAlert("Couldn't raise the target", () =>
        tracker.acceptTargetUpdate(workoutId, offer.templateExerciseId),
      );
    }
  }
}

// Asks a yes-or-no question; true when the lifter accepts. Dismissing it
// declines.
function ask(title: string, message: string, decline: string, accept: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: decline, style: 'cancel', onPress: () => resolve(false) },
        { text: accept, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
