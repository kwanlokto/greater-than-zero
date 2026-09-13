import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';
import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';

// Picks an Exercise from the library, either to add to a Workout (workoutId)
// or to swap in for one already there (swapEntryId).
export default function ChooseExerciseScreen() {
  const { workoutId, swapEntryId } = useLocalSearchParams<{
    workoutId?: string;
    swapEntryId?: string;
  }>();
  const router = useRouter();
  // One tap picks one Exercise, even if the lifter taps again while leaving.
  const choosing = useRef(false);

  async function choose(exercise: Exercise) {
    if (choosing.current) return;
    choosing.current = true;
    try {
      if (swapEntryId) await tracker.swapExercise(swapEntryId, exercise.id);
      else if (workoutId) await tracker.addExerciseToWorkout(workoutId, exercise.id);
      router.back();
    } catch (error) {
      choosing.current = false;
      Alert.alert(
        swapEntryId ? "Couldn't swap the exercise" : "Couldn't add the exercise",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: swapEntryId ? 'Swap exercise' : 'Add exercise' }} />
      <ExerciseBrowser
        renderExercise={exercise => (
          <ExerciseRow
            exercise={exercise}
            icon={swapEntryId ? 'swap-horizontal' : 'add-circle-outline'}
            onPress={() => choose(exercise)}
          />
        )}
      />
    </>
  );
}
