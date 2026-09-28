import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';

// Picks an Exercise for a Template, then asks for its Target.
export default function ChooseTemplateExerciseScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const router = useRouter();

  return (
    <ExerciseBrowser
      renderExercise={exercise => (
        <ExerciseRow
          exercise={exercise}
          icon="add-circle-outline"
          onPress={() =>
            router.replace({
              pathname: '/templates/target',
              params: { templateId, exerciseId: exercise.id },
            })
          }
        />
      )}
    />
  );
}
