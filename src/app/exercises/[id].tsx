import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { ExerciseForm } from '@/components/exercise-form';
import { RestLengthPicker } from '@/components/rest-length-picker';
import { TextButton } from '@/components/text-button';
import { tracker } from '@/database';
import { exerciseDetails } from '@/exercise-labels';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Exercise in the library. Every Exercise has a rest length to choose;
// only custom ones can be edited or hidden.
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
        <Text style={[styles.details, { color: colors.text }]}>
          {exerciseDetails(exercise)} · Built-in
        </Text>
      )}
      <RestLengthPicker exercise={exercise} />
      {exercise.isCustom && <TextButton label="Hide exercise" destructive onPress={confirmHide} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  details: {
    fontSize: 16,
    opacity: 0.7,
  },
});
