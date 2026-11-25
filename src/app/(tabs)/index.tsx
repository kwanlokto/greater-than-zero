import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DailyTotalsCard } from '@/components/daily-totals-card';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { WeighInCard } from '@/components/weigh-in-card';
import type { NewWorkout, Workout } from '@/core/tracker';
import { tracker } from '@/database';
import { hasMacroTargets } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { space, useAppTheme } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';
import { doneWorkoutSummary, lastDone, workoutExercises, workoutName } from '@/workout-labels';

// Today at a glance, on one screen: what to train, what's been eaten against
// the day's targets, and today's weight.
export default function TodayScreen() {
  const router = useRouter();
  const workoutInProgress = useWorkoutInProgress();
  // One of each kind of Workout done before, the latest first.
  const toRepeat = useTrackerQuery(() => tracker.getWorkoutsToRepeat(), []);
  // Null once loaded with no active Rotation, or an empty one.
  const nextUp = useTrackerQuery(() => tracker.getNextUp(), []);
  const today = useToday();
  // What was recorded today. Its Workouts are the finished ones, in the order
  // they were done, so the last is the one just finished.
  const day = useTrackerQuery(() => tracker.getDay(today), [today]);
  const doneToday = day?.workouts[day.workouts.length - 1];
  // "Start another" brings the Start section back, until a Workout starts.
  const [startingAnother, setStartingAnother] = useState(false);
  useEffect(() => {
    if (workoutInProgress) setStartingAnother(false);
  }, [workoutInProgress]);
  const dailyTotals = useTrackerQuery(() => tracker.getDailyTotals(today), [today]);
  // Null once loaded with no Weigh-in today.
  const weighIn = useTrackerQuery(() => tracker.getWeighIn(today), [today]);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  async function start(workout?: NewWorkout) {
    const started = await runOrAlert("Couldn't start the workout", () =>
      tracker.startWorkout(workout),
    );
    if (started) router.push('/workout');
  }

  return (
    <Screen onTab contentStyle={styles.content}>
      {/* Only one Workout can be in progress; while one is, the Workout bar
          returns to it. Once one's finished today, it takes the Start
          section's place, which "Start another" brings back. */}
      {workoutInProgress === null && toRepeat && nextUp !== undefined && day &&
        (doneToday && !startingAnother ? (
          <Section
            title="Today's workout"
            action={{ label: 'Start another', onPress: () => setStartingAnother(true) }}
          >
            <DoneToday
              workout={doneToday}
              // navigate, not push, so a double tap opens it once.
              onPress={() =>
                router.navigate({ pathname: '/workout/[id]', params: { id: doneToday.id } })
              }
            />
            {nextUp && (
              <AppText variant="caption" tone="muted" style={styles.nextUpLine}>
                Next up: {nextUp.name}
              </AppText>
            )}
          </Section>
        ) : (
          <Section
            title="Start a workout"
            action={
              // Next up comes from the active Rotation; point the way to one,
              // once there's a Workout it could suggest.
              !nextUp && toRepeat.length > 0
                ? { label: 'Set up a rotation', onPress: () => router.navigate('/rotations') }
                : undefined
            }
          >
            {nextUp && (
              <NextUp
                name={nextUp.name}
                detail={
                  nextUp.latest
                    ? // When comes first, so a long list of Exercises is what gets cut short.
                      `${lastDone(nextUp.latest.localDate, today)} · ${workoutExercises(nextUp.latest)}`
                    : 'Not done yet: starts empty'
                }
                // Repeats its latest Workout, or starts one empty in it. Guarded
                // by the button: a double tap starts one Workout.
                onStart={() => start(nextUp.start)}
              />
            )}
            <View style={styles.ways}>
              {/* Nothing to repeat until a Workout has been finished. */}
              {toRepeat.length > 0 && (
                <Button
                  variant="tonal"
                  icon="repeat"
                  label="Repeat a workout"
                  // navigate, not push, so a double tap opens the list once.
                  onPress={() => router.navigate('/workout/repeat')}
                />
              )}
              <Button
                variant={toRepeat.length === 0 ? 'primary' : 'secondary'}
                icon="add"
                label="Empty workout"
                accessibilityLabel="Start empty workout"
                onPress={() => start()}
              />
            </View>
          </Section>
        ))}
      {dailyTotals && (
        <Section
          title="Today's food"
          action={
            hasMacroTargets(dailyTotals)
              ? { label: 'Meals', onPress: () => router.navigate('/food') }
              : { label: 'Set daily targets', onPress: () => router.navigate('/macro-targets') }
          }
        >
          <DailyTotalsCard
            totals={dailyTotals}
            hint="Opens today's meals"
            onPress={() => router.navigate('/food')}
          />
        </Section>
      )}
      {weighIn !== undefined && displayUnit && (
        <Section
          title="Today's weigh-in"
          action={{ label: 'All weigh-ins', onPress: () => router.navigate('/weigh-ins') }}
        >
          <WeighInCard
            weighIn={weighIn}
            displayUnit={displayUnit}
            onSave={async weight =>
              Boolean(
                await runOrAlert("Couldn't save the weigh-in", () =>
                  tracker.setWeighIn(weight, displayUnit),
                ),
              )
            }
          />
        </Section>
      )}
    </Screen>
  );
}

type NextUpProps = {
  name: string;
  // What's in it and when it was last done.
  detail: string;
  onStart: () => Promise<void>;
};

// The active Rotation's next up, to start with one tap.
function NextUp({ name, detail, onStart }: NextUpProps) {
  return (
    <Card style={styles.nextUp}>
      <View style={styles.nextUpText}>
        <AppText accessibilityRole="header" variant="overline" tone="primary">
          Next up
        </AppText>
        <AppText variant="heading" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      <Button
        icon="play"
        label="Start"
        accessibilityLabel={`Start ${name}`}
        accessibilityHint={detail}
        onPress={onStart}
        style={styles.start}
      />
    </Card>
  );
}

// The Workout finished today, in the Start section's place. Tapping it opens
// the Workout, to correct a Set while it's fresh.
function DoneToday({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Card
      onPress={onPress}
      accessibilityHint="Opens this workout, to look over or correct"
      style={styles.nextUp}
    >
      <View style={styles.nextUpText}>
        <AppText variant="overline" tone="primary">
          Done
        </AppText>
        <AppText variant="heading" numberOfLines={1}>
          {workoutName(workout)}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {doneWorkoutSummary(workout)}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
  },
  nextUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  nextUpText: {
    flex: 1,
    gap: 2,
  },
  start: {
    paddingHorizontal: space.xl,
  },
  // Under the Done card, in line with its text.
  nextUpLine: {
    paddingHorizontal: space.xs,
  },
  // The other ways to start, one under the other: side by side, their labels
  // don't fit a narrow phone.
  ways: {
    gap: space.sm,
  },
});
