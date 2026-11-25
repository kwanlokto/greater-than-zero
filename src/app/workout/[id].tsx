import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ExerciseEntryCard, entryCardKey } from '@/components/exercise-entry-card';
import { Screen } from '@/components/screen';
import { WorkoutTitle } from '@/components/workout-title';
import { tracker } from '@/database';
import { confirmThenRun, runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';
import { finishedWorkoutWhen, workoutName } from '@/workout-labels';

// A finished Workout, opened from History or from Today's Done card. Repeating
// it comes first: started again today, with what was logged planned. It can
// also be corrected with the same tools as during a Workout; it keeps its date
// and stays finished, and there's no rest.
export default function PastWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Null once there's no such Workout, e.g. after it's deleted.
  const workout = useTrackerQuery(async () => (await tracker.getWorkout(id)) ?? null, [id]);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);
  const workoutInProgress = useWorkoutInProgress();

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This workout was deleted." />
      </Screen>
    );
  }

  const confirmDelete = async () => {
    const done = await confirmThenRun(
      {
        title: 'Delete this workout?',
        message: 'Its exercises and sets will be removed from History.',
        decline: 'Cancel',
        accept: 'Delete',
        destructive: true,
      },
      "Couldn't delete the workout",
      () => tracker.deleteWorkout(workout.id),
    );
    if (done) router.back();
  };

  // Guarded by the button, and by the core: a double tap starts one Workout.
  const repeat = async () => {
    const started = await runOrAlert("Couldn't start the workout", () =>
      tracker.startWorkout({ repeatOf: workout.id }),
    );
    if (!started) return;
    // The new Workout sits on Today, not on this old one: History's screens
    // close first, so hiding it never lands back here.
    router.dismissAll();
    router.navigate('/');
    router.push('/workout');
  };

  return (
    <Screen contentStyle={styles.content}>
      <Stack.Screen
        options={{
          title: workoutName(workout),
          // Tapping the title chooses the Workout's Category.
          headerTitle: () => <WorkoutTitle workoutId={workout.id} title={workoutName(workout)} />,
        }}
      />
      <AppText tone="muted" style={styles.times}>
        {finishedWorkoutWhen(workout)}
      </AppText>
      {workoutInProgress === null && (
        <Button icon="repeat" label="Repeat this workout" onPress={repeat} />
      )}
      {/* One Workout at a time, so repeating waits for the one in progress.
          The Workout bar is on the tabs, so this is the way back to it. */}
      {workoutInProgress && (
        <Card>
          <AppText tone="muted">Finish the workout in progress to repeat this one.</AppText>
          <Button
            variant="tonal"
            icon="barbell-outline"
            label="Go to the workout in progress"
            onPress={() => router.navigate('/workout')}
          />
        </Card>
      )}
      {workout.entries.map(entry => (
        <ExerciseEntryCard
          key={entryCardKey(entry)}
          entry={entry}
          displayUnit={displayUnit}
          finished
        />
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
