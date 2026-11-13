import { Stack, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ExerciseEntryCard } from '@/components/exercise-entry-card';
import { IconButton } from '@/components/icon-button';
import { RestTimer } from '@/components/rest-timer';
import { Screen } from '@/components/screen';
import { canFinishWorkout, type FinishSummary } from '@/core/tracker';
import { tracker } from '@/database';
import { askFinishOffers } from '@/finish-offers';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';
import { backfillTitle } from '@/workout-labels';

export default function WorkoutScreen() {
  const router = useRouter();
  const workout = useWorkoutInProgress();
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return (
      <Screen>
        <EmptyState icon="barbell-outline" title="No workout in progress." />
      </Screen>
    );
  }

  // A discarded Workout is never recorded, so it won't appear in History.
  const discard = async () => {
    if (
      await runOrAlert("Couldn't discard the workout", () => tracker.discardWorkout(workout.id))
    ) {
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
          let summary: FinishSummary | undefined;
          const finished = await runOrAlert("Couldn't finish the workout", async () => {
            summary = await tracker.finishWorkout(workout.id);
          });
          if (!finished || !summary) return;
          router.back();
          askFinishOffers(workout.id, summary);
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
          title: backfillTitle(workout) ?? 'Workout',
          // Hides the Workout without ending it; the Workout bar brings it back.
          headerLeft: () => (
            <IconButton
              icon="chevron-down"
              label="Hide workout"
              onPress={() => router.back()}
              style={{ marginLeft: -space.sm, marginRight: space.xs }}
            />
          ),
          headerRight: () => (
            <Button
              size="small"
              label="Finish"
              onPress={confirmFinish}
              style={{ marginRight: space.sm }}
            />
          ),
        }}
      />
      <Screen
        contentStyle={{ gap: space.lg }}
        // The rest countdown stays in view, at the foot of the screen.
        footer={
          workout.restEndsAt ? (
            <RestTimer workoutId={workout.id} restEndsAt={workout.restEndsAt} />
          ) : undefined
        }
      >
        {workout.entries.length === 0 && (
          <EmptyState
            icon="barbell-outline"
            title="No exercises yet"
            message="Add an exercise to start logging sets."
          />
        )}
        {workout.entries.map(entry => (
          <ExerciseEntryCard key={entry.id} entry={entry} displayUnit={displayUnit} />
        ))}
        <Button
          variant={workout.entries.length === 0 ? 'primary' : 'secondary'}
          size="large"
          icon="add"
          label="Add exercise"
          onPress={() =>
            router.push({ pathname: '/workout/choose-exercise', params: { workoutId: workout.id } })
          }
        />
        {workout.entries.length > 0 && (
          <Button size="large" icon="checkmark" label="Finish workout" onPress={confirmFinish} />
        )}
        <Button variant="ghost" destructive label="Discard workout" onPress={confirmDiscard} />
      </Screen>
    </>
  );
}
