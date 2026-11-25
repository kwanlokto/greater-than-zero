import { useRouter } from 'expo-router';
import { useRef } from 'react';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import type { Workout } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { lastDone, workoutExercises, workoutName } from '@/workout-labels';

// Picks a Workout to do again: one of each kind done before, the latest of
// it, the most recently done first. Tapping one starts today's Workout from
// it, with what was logged then planned, and opens it.
export default function RepeatWorkoutScreen() {
  const router = useRouter();
  const today = useToday();
  const workouts = useTrackerQuery(() => tracker.getWorkoutsToRepeat(), []);
  // One tap starts one Workout, even if the lifter taps again while leaving.
  const starting = useRef(false);

  async function repeat(workout: Workout) {
    if (starting.current) return;
    starting.current = true;
    const started = await runOrAlert("Couldn't start the workout", () =>
      tracker.startWorkout({ repeatOf: workout.id }),
    );
    // The Workout takes this list's place, so leaving it goes back to Today.
    if (started) router.replace('/workout');
    else starting.current = false;
  }

  return (
    <Screen contentStyle={{ gap: space.md }}>
      {workouts?.length === 0 && (
        <EmptyState
          icon="barbell-outline"
          title="No finished workouts yet"
          message="Once you finish a workout, you can start it again from here."
        />
      )}
      {workouts && workouts.length > 0 && (
        <>
          <AppText tone="muted">
            Tap a workout to start it again today, with the sets you logged then filled in.
          </AppText>
          <ListGroup>
            {workouts.map(workout => (
              <ListRow
                key={workout.id}
                title={workoutName(workout)}
                subtitle={workoutExercises(workout)}
                value={lastDone(workout.localDate, today)}
                trailingIcon="play"
                trailingIconTone="primary"
                accessibilityHint="Starts this workout again today"
                onPress={() => repeat(workout)}
              />
            ))}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}
