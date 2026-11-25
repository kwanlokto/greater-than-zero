import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';

import { ExerciseForm } from '@/components/exercise-form';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { choiceFor, type ChoiceParams } from '@/exercise-choice';
import { runOrAlert } from '@/run-or-alert';

// Opened from the library, it adds an Exercise there. Opened from a Workout's
// chooser, it's also told what the chooser was for, and does that with the
// Exercise it makes: adds it to the Workout, or swaps it in.
type Params = ChoiceParams & { name?: string };

export default function NewExerciseScreen() {
  const router = useRouter();
  const { name, ...openedFor } = useLocalSearchParams<Params>();
  // Undefined when it was opened from the library.
  const choice = choiceFor(openedFor);
  // One tap makes one Exercise, even if the lifter taps again while leaving.
  const leaving = useRef(false);

  return (
    <Screen>
      <ExerciseForm
        // What was typed in the chooser's search box, to save typing it twice.
        initial={{ name }}
        submitLabel="Add exercise"
        onSubmit={async values => {
          if (leaving.current) return;
          leaving.current = true;
          const created = await runOrAlert("Couldn't add the exercise", () =>
            tracker.createExercise(values),
          );
          // Stays on the form when it's refused, to fix and try again.
          if (!created) {
            leaving.current = false;
            return;
          }
          if (!choice) {
            router.back();
            return;
          }
          const placed = await runOrAlert<unknown>(choice.failure, () =>
            choice.run(created.result),
          );
          // Back to the Workout, past the chooser. If it couldn't be put
          // there, only as far as the chooser, where it's now listed to pick.
          router.dismiss(placed ? 2 : 1);
        }}
      />
    </Screen>
  );
}
