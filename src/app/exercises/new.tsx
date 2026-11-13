import { useRouter } from 'expo-router';

import { ExerciseForm } from '@/components/exercise-form';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';

export default function NewExerciseScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ExerciseForm
        initial={{}}
        submitLabel="Add exercise"
        onSubmit={async values => {
          await tracker.createExercise(values);
          router.back();
        }}
      />
    </Screen>
  );
}
