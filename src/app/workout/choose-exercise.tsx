import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';
import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

type Params = { workoutId?: string; swapEntryId?: string };

// What choosing an Exercise does: add it to a Workout (workoutId) or swap it in
// for one already there (swapEntryId).
function choiceFor({ workoutId, swapEntryId }: Params) {
  if (swapEntryId) {
    return {
      title: 'Swap exercise',
      icon: 'swap-horizontal',
      failure: "Couldn't swap the exercise",
      run: (exercise: Exercise) => tracker.swapExercise(swapEntryId, exercise.id),
    } as const;
  }
  if (workoutId) {
    return {
      title: 'Add exercise',
      icon: 'add-circle-outline',
      failure: "Couldn't add the exercise",
      run: (exercise: Exercise) => tracker.addExerciseToWorkout(workoutId, exercise.id),
    } as const;
  }
  return undefined;
}

export default function ChooseExerciseScreen() {
  const params = useLocalSearchParams<Params>();
  const choice = choiceFor(params);
  const router = useRouter();
  // One tap picks one Exercise, even if the lifter taps again while leaving.
  const choosing = useRef(false);

  if (!choice) return null;

  async function choose(exercise: Exercise) {
    if (!choice || choosing.current) return;
    choosing.current = true;
    // Adding and swapping return different things; only whether it ran matters.
    if (await runOrAlert<unknown>(choice.failure, () => choice.run(exercise))) router.back();
    else choosing.current = false;
  }

  return (
    <>
      <Stack.Screen options={{ title: choice.title }} />
      <ExerciseBrowser
        renderExercise={exercise => (
          <ExerciseRow exercise={exercise} icon={choice.icon} onPress={() => choose(exercise)} />
        )}
        // One the library lacks is made without leaving the Workout: New
        // exercise is told what this chooser was opened for, and does it.
        onNewExercise={name =>
          router.navigate({
            pathname: '/exercises/new',
            params: {
              name,
              ...(params.swapEntryId
                ? { swapEntryId: params.swapEntryId }
                : { workoutId: params.workoutId }),
            },
          })
        }
      />
    </>
  );
}
