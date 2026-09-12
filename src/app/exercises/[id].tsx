import { useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ExerciseForm } from '@/components/exercise-form';
import { tracker } from '@/database';
import { useTrackerQuery } from '@/use-tracker-query';

export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const exercise = useTrackerQuery(() => tracker.getExercise(id), [id]);

  // Only custom Exercises can be edited.
  if (!exercise?.isCustom) return null;

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
            await tracker.hideExercise(id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ExerciseForm
        initial={exercise}
        trackingTypeFixed
        submitLabel="Save"
        onSubmit={async ({ name, muscleGroup }) => {
          await tracker.editExercise(id, { name, muscleGroup });
          router.back();
        }}
      />
      <Pressable accessibilityRole="button" onPress={confirmHide} style={styles.hide}>
        <Text style={[styles.hideLabel, { color: colors.notification }]}>Hide exercise</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  hide: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  hideLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
