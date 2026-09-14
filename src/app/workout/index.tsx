import { Stack, useRouter, useTheme } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseEntryCard } from '@/components/exercise-entry-card';
import { PrimaryButton } from '@/components/primary-button';
import { RestTimer } from '@/components/rest-timer';
import { TextButton } from '@/components/text-button';
import { canFinishWorkout } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

export default function WorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const workout = useWorkoutInProgress();
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return <Text style={[styles.message, { color: colors.text }]}>No workout in progress.</Text>;
  }

  // A discarded Workout is never recorded, so it won't appear in History.
  const discard = async () => {
    if (await runOrAlert("Couldn't discard the workout", () => tracker.discardWorkout(workout.id))) {
      router.back();
    }
  };

  const confirmFinish = () => {
    // With nothing logged there's nothing to record, so the way out is Discard.
    if (!canFinishWorkout(workout)) {
      Alert.alert('No sets logged yet', 'Log a set to finish this workout, or discard it.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
      ]);
      return;
    }
    Alert.alert('Finish workout?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          if (await runOrAlert("Couldn't finish the workout", () => tracker.finishWorkout(workout.id))) {
            router.back();
          }
        },
      },
    ]);
  };

  const confirmDiscard = () => {
    Alert.alert('Discard this workout?', 'Its exercises and sets will not be saved.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discard },
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
      <View style={styles.screen}>
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
              router.push({ pathname: '/workout/choose-exercise', params: { workoutId: workout.id } })
            }
          />
          <TextButton label="Discard workout" destructive onPress={confirmDiscard} />
        </ScrollView>
        <RestTimer workoutId={workout.id} restEndsAt={workout.restEndsAt} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
