import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';

// What a Workout's chooser was opened for: the Workout to add an Exercise to
// (workoutId), or the Exercise entry to swap one into (swapEntryId).
export type ChoiceParams = { workoutId?: string; swapEntryId?: string };

// What choosing an Exercise does there: how the chooser is titled, how its
// rows are marked, and the command that puts an Exercise in the Workout. New
// exercise, opened from the chooser, runs the same command on the Exercise it
// makes, and is handed `params` to know which. Undefined when the chooser was
// opened for neither.
export function choiceFor({ workoutId, swapEntryId }: ChoiceParams) {
  if (swapEntryId) {
    return {
      title: 'Swap exercise',
      icon: 'swap-horizontal',
      failure: "Couldn't swap the exercise",
      params: { swapEntryId },
      run: (exercise: Exercise) => tracker.swapExercise(swapEntryId, exercise.id),
    } as const;
  }
  if (workoutId) {
    return {
      title: 'Add exercise',
      icon: 'add-circle-outline',
      failure: "Couldn't add the exercise",
      params: { workoutId },
      run: (exercise: Exercise) => tracker.addExerciseToWorkout(workoutId, exercise.id),
    } as const;
  }
  return undefined;
}
