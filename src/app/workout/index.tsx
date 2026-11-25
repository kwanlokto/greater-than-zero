import { Stack, useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ExerciseEntryCard, entryCardKey } from '@/components/exercise-entry-card';
import { IconButton } from '@/components/icon-button';
import { RestTimer } from '@/components/rest-timer';
import { Screen } from '@/components/screen';
import { WorkoutTitle } from '@/components/workout-title';
import { alertPrompter } from '@/alert-prompter';
import { canFinishWorkout } from '@/core/tracker';
import { tracker } from '@/database';
import { discardWorkout, finishWorkout, type Landing } from '@/leave-workout';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';
import { backfillTitle, workoutName } from '@/workout-labels';

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

  // A Workout ends on Today, whatever was underneath it. A backfilled one
  // goes back to the Day it was added to, opening it if it isn't underneath.
  const close = (landing: Landing) => {
    if (landing.on === 'day') {
      router.dismissTo({ pathname: '/day/[date]', params: { date: landing.localDate } });
      return;
    }
    router.dismissAll();
    router.navigate('/');
  };

  const confirmFinish = async () => {
    await finishWorkout(tracker, alertPrompter, workout, close);
  };

  const confirmDiscard = async () => {
    await discardWorkout(tracker, alertPrompter, workout, close);
  };

  // Nothing to record until a Set is logged, so the way out is discarding.
  const canFinish = canFinishWorkout(workout);

  return (
    <>
      <Stack.Screen
        options={{
          title: backfillTitle(workout) ?? workoutName(workout),
          // Tapping the title chooses the Workout's Category.
          headerTitle: () => (
            <WorkoutTitle
              workoutId={workout.id}
              title={backfillTitle(workout) ?? workoutName(workout)}
            />
          ),
          // Hides the Workout without ending it; the Workout bar brings it back.
          headerLeft: () => (
            <IconButton
              icon="chevron-down"
              label="Hide workout"
              onPress={() => router.back()}
              style={{ marginLeft: -space.sm, marginRight: space.xs }}
            />
          ),
          // The exit that works now: one started by mistake is discarded from
          // here, and once a Set is logged it's finished from here.
          headerRight: () =>
            canFinish ? (
              <Button
                size="small"
                label="Finish"
                accessibilityLabel="Finish workout"
                onPress={confirmFinish}
                style={{ marginRight: space.sm }}
              />
            ) : (
              <Button
                variant="ghost"
                destructive
                size="small"
                label="Discard"
                accessibilityLabel="Discard workout"
                onPress={confirmDiscard}
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
          <ExerciseEntryCard key={entryCardKey(entry)} entry={entry} displayUnit={displayUnit} />
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
        {canFinish && (
          <Button size="large" icon="checkmark" label="Finish workout" onPress={confirmFinish} />
        )}
        <Button variant="ghost" destructive label="Discard workout" onPress={confirmDiscard} />
      </Screen>
    </>
  );
}
