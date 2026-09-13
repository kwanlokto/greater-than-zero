import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';
import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';

export default function AddExerciseScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  // One tap adds one Exercise, even if the lifter taps again while leaving.
  const adding = useRef(false);

  async function add(exercise: Exercise) {
    if (adding.current) return;
    adding.current = true;
    await tracker.addExerciseToWorkout(workoutId, exercise.id);
    router.back();
  }

  return (
    <ExerciseBrowser
      renderExercise={exercise => (
        <ExerciseRow exercise={exercise} icon="add-circle-outline" onPress={() => add(exercise)} />
      )}
    />
  );
}
