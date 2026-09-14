import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { ExerciseEntryCard } from '@/components/exercise-entry-card';
import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import { workoutTimes } from '@/components/workout-card';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// A finished Workout opened from History, corrected with the same tools as
// during a Workout. It keeps its date and stays finished; there's no rest.
export default function PastWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's no such Workout, e.g. after it's deleted.
  const workout = useTrackerQuery(async () => (await tracker.getWorkout(id)) ?? null, [id]);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return <Text style={[styles.message, { color: colors.text }]}>This workout was deleted.</Text>;
  }

  const confirmDelete = () => {
    Alert.alert('Delete this workout?', 'Its exercises and sets will be removed from History.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await runOrAlert("Couldn't delete the workout", () => tracker.deleteWorkout(workout.id))) {
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: formatLocalDateWithWeekday(workout.localDate) }} />
      <Text style={[styles.times, { color: colors.text }]}>{workoutTimes(workout)}</Text>
      {workout.entries.map(entry => (
        <ExerciseEntryCard key={entry.id} entry={entry} displayUnit={displayUnit} />
      ))}
      <PrimaryButton
        label="Add exercise"
        onPress={() =>
          router.push({ pathname: '/workout/choose-exercise', params: { workoutId: workout.id } })
        }
      />
      <TextButton label="Delete workout" destructive onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  times: {
    fontSize: 14,
    opacity: 0.7,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
