import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import type { Workout } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { lastDone, workoutExercises, workoutName } from '@/workout-labels';

// How many earlier Workouts each "Show more" adds.
const earlierPage = 20;

// Picks a Workout to do again: one of each kind done before, the latest of
// it, the most recently done first. Tapping one starts today's Workout from
// it, with what was logged then planned, and opens it. Every other finished
// Workout is under "Show earlier workouts", so any of them can be started
// without knowing its date.
export default function RepeatWorkoutScreen() {
  const router = useRouter();
  const today = useToday();
  const workouts = useTrackerQuery(() => tracker.getWorkoutsToRepeat(), []);
  // How many earlier Workouts are shown: none until they're asked for, so the
  // short list is what opens. One is still read, to know whether to offer them.
  const [earlierShown, setEarlierShown] = useState(0);
  const earlier = useTrackerQuery(
    () => tracker.getEarlierWorkouts(Math.max(earlierShown, 1)),
    [earlierShown],
  );
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
          <WorkoutRows workouts={workouts} today={today} onRepeat={repeat} />
          {earlierShown === 0 && earlier && earlier.workouts.length > 0 && (
            <Button
              variant="ghost"
              icon="time-outline"
              label="Show earlier workouts"
              onPress={() => setEarlierShown(earlierPage)}
            />
          )}
          {earlierShown > 0 && earlier && (
            <Section title="Earlier workouts">
              <WorkoutRows workouts={earlier.workouts} today={today} onRepeat={repeat} />
              {earlier.more && (
                <Button
                  variant="ghost"
                  label="Show more"
                  onPress={() => setEarlierShown(shown => shown + earlierPage)}
                />
              )}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

type RowsProps = {
  workouts: Workout[];
  today: string;
  onRepeat: (workout: Workout) => void;
};

// Workouts to start again, each with what's in it and when it was done, so
// none is started blind.
function WorkoutRows({ workouts, today, onRepeat }: RowsProps) {
  return (
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
          onPress={() => onRepeat(workout)}
        />
      ))}
    </ListGroup>
  );
}
