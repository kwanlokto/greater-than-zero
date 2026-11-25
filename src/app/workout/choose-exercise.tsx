import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';

import { ExerciseBrowser, ExerciseRow } from '@/components/exercise-browser';
import type { Exercise } from '@/core/tracker';
import { choiceFor, type ChoiceParams } from '@/exercise-choice';
import { runOrAlert } from '@/run-or-alert';

export default function ChooseExerciseScreen() {
  const choice = choiceFor(useLocalSearchParams<ChoiceParams>());
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
          router.navigate({ pathname: '/exercises/new', params: { name, ...choice.params } })
        }
      />
    </>
  );
}
