import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ExerciseEntryCard } from '@/components/exercise-entry-card';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';
import { workoutTimes } from '@/workout-labels';

// A finished Workout opened from History, corrected with the same tools as
// during a Workout. It keeps its date and stays finished; there's no rest.
export default function PastWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Null once there's no such Workout, e.g. after it's deleted.
  const workout = useTrackerQuery(async () => (await tracker.getWorkout(id)) ?? null, [id]);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This workout was deleted." />
      </Screen>
    );
  }

  const confirmDelete = () => {
    Alert.alert('Delete this workout?', 'Its exercises and sets will be removed from History.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (
            await runOrAlert("Couldn't delete the workout", () => tracker.deleteWorkout(workout.id))
          ) {
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.content}>
      <Stack.Screen options={{ title: formatLocalDateWithWeekday(workout.localDate) }} />
      <AppText tone="muted" style={styles.times}>
        {workoutTimes(workout)}
      </AppText>
      {workout.entries.map(entry => (
        <ExerciseEntryCard key={entry.id} entry={entry} displayUnit={displayUnit} />
      ))}
      <Button
        variant="secondary"
        size="large"
        icon="add"
        label="Add exercise"
        onPress={() =>
          router.push({ pathname: '/workout/choose-exercise', params: { workoutId: workout.id } })
        }
      />
      <Button
        variant="secondary"
        icon="bookmark-outline"
        label="Save as template"
        onPress={() =>
          router.push({ pathname: '/templates/new', params: { fromWorkoutId: workout.id } })
        }
      />
      <Button variant="ghost" destructive label="Delete workout" onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.lg,
  },
  times: {
    paddingHorizontal: space.xs,
    marginBottom: -space.sm,
  },
});
