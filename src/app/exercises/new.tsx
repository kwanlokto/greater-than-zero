import { useRouter } from 'expo-router';

import { ExerciseForm } from '@/components/exercise-form';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

export default function NewExerciseScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ExerciseForm
        initial={{}}
        submitLabel="Add exercise"
        onSubmit={async values => {
          // Stays on the form when it's refused, to fix and try again.
          if (await runOrAlert("Couldn't add the exercise", () => tracker.createExercise(values))) {
            router.back();
          }
        }}
      />
    </Screen>
  );
}
