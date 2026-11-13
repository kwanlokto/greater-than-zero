import { useRouter } from 'expo-router';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';
import { Fab, fabClearance } from '@/components/fab';

export default function ExerciseLibraryScreen() {
  const router = useRouter();

  return (
    <>
      <ExerciseBrowser
        bottomSpace={fabClearance}
        renderExercise={exercise => (
          // Every Exercise opens, for its rest length; custom ones also for editing.
          <ExerciseRow
            exercise={exercise}
            icon="chevron-forward"
            onPress={() =>
              router.push({ pathname: '/exercises/[id]', params: { id: exercise.id } })
            }
          />
        )}
      />
      <Fab label="New exercise" onPress={() => router.push('/exercises/new')} />
    </>
  );
}
