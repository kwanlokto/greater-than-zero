import { Stack, useRouter, useTheme } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ExerciseEntryCard } from '@/components/exercise-entry-card';
import { PrimaryButton } from '@/components/primary-button';
import { tracker } from '@/database';
import { useTrackerQuery } from '@/use-tracker-query';

export default function WorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const workout = useTrackerQuery(() => tracker.getWorkoutInProgress(), []);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return <Text style={[styles.message, { color: colors.text }]}>No workout in progress.</Text>;
  }

  const confirmFinish = () => {
    Alert.alert('Finish workout?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          await tracker.finishWorkout(workout.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" hitSlop={12} onPress={confirmFinish}>
              <Text style={[styles.finish, { color: colors.primary }]}>Finish</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {workout.entries.length === 0 && (
          <Text style={[styles.message, { color: colors.text }]}>
            Add an exercise to start logging sets.
          </Text>
        )}
        {workout.entries.map(entry => (
          <ExerciseEntryCard key={entry.id} entry={entry} displayUnit={displayUnit} />
        ))}
        <PrimaryButton
          label="Add exercise"
          onPress={() =>
            router.push({ pathname: '/workout/add-exercise', params: { workoutId: workout.id } })
          }
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  finish: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
