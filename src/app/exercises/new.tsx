import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExerciseForm } from '@/components/exercise-form';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// Opened from the library, it adds an Exercise there. Opened from a Workout's
// chooser, it's also told what the chooser was for: the Workout to add the new
// Exercise to, or the Exercise entry to swap it into.
type Params = { name?: string; workoutId?: string; swapEntryId?: string };

export default function NewExerciseScreen() {
  const router = useRouter();
  const { name, workoutId, swapEntryId } = useLocalSearchParams<Params>();

  // Puts the new Exercise where the chooser was going to put the one picked.
  // Undefined when there's nowhere: it was made from the library.
  const place = swapEntryId
    ? {
        failure: "Couldn't swap the exercise",
        run: (exerciseId: string) => tracker.swapExercise(swapEntryId, exerciseId),
      }
    : workoutId
      ? {
          failure: "Couldn't add the exercise to the workout",
          run: (exerciseId: string) => tracker.addExerciseToWorkout(workoutId, exerciseId),
        }
      : undefined;

  return (
    <Screen>
      <ExerciseForm
        // What was typed in the chooser's search box, to save typing it twice.
        initial={{ name }}
        submitLabel="Add exercise"
        // Guarded by the form's button: a double tap makes one Exercise.
        onSubmit={async values => {
          // Stays on the form when it's refused, to fix and try again.
          const created = await runOrAlert("Couldn't add the exercise", () =>
            tracker.createExercise(values),
          );
          if (!created) return;
          if (!place) {
            router.back();
            return;
          }
          const placed = await runOrAlert<unknown>(place.failure, () =>
            place.run(created.result.id),
          );
          // Back to the Workout, past the chooser. If it couldn't be placed,
          // only as far as the chooser, where it's now listed to pick.
          router.dismiss(placed ? 2 : 1);
        }}
      />
    </Screen>
  );
}
