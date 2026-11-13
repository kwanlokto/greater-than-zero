import { Stack, useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ExerciseEntryCard } from '@/components/exercise-entry-card';
import { IconButton } from '@/components/icon-button';
import { RestTimer } from '@/components/rest-timer';
import { Screen } from '@/components/screen';
import { alertPrompter } from '@/alert-prompter';
import { tracker } from '@/database';
import { finishWorkout } from '@/finish-workout';
import { confirmThenRun } from '@/run-or-alert';
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

  const confirmFinish = async () => {
    await finishWorkout(tracker, alertPrompter, workout, () => router.back());
  };

  // A discarded Workout is never recorded, so it won't appear in History.
  const confirmDiscard = async () => {
    const discarded = await confirmThenRun(
      {
        title: 'Discard this workout?',
        message: 'Its exercises and sets will not be saved.',
        decline: 'Keep it',
        accept: 'Discard',
        destructive: true,
      },
      "Couldn't discard the workout",
      () => tracker.discardWorkout(workout.id),
    );
    if (discarded) router.back();
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
