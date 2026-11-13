import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ExerciseForm } from '@/components/exercise-form';
import { RestLengthPicker } from '@/components/rest-length-picker';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { exerciseDetails } from '@/exercise-labels';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Exercise in the library. Every Exercise has a rest length to choose;
// only custom ones can be edited or hidden.
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exercise = useTrackerQuery(() => tracker.getExercise(id), [id]);

  if (!exercise) return null;

  const confirmHide = () => {
    Alert.alert(
      `Hide ${exercise.name}?`,
      'It will no longer appear in the library. Workouts that used it keep its name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            if (await runOrAlert("Couldn't hide the exercise", () => tracker.hideExercise(id))) {
              router.back();
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      {exercise.isCustom ? (
        <ExerciseForm
          initial={exercise}
          trackingTypeFixed
          submitLabel="Save"
          onSubmit={async ({ name, muscleGroup }) => {
            if (
              await runOrAlert("Couldn't save the exercise", () =>
                tracker.editExercise(id, { name, muscleGroup }),
              )
            ) {
              router.back();
            }
          }}
        />
      ) : (
        <Card>
          <AppText variant="bodyStrong">{exerciseDetails(exercise)}</AppText>
          <AppText tone="muted">Built in, so only its rest can be changed.</AppText>
        </Card>
      )}
      <RestLengthPicker exercise={exercise} />
      {exercise.isCustom && (
        <Button variant="ghost" destructive label="Hide exercise" onPress={confirmHide} />
      )}
    </Screen>
  );
}
