import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatBodyWeight } from '@/body-weight-labels';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { IconButton } from '@/components/icon-button';
import { MealCard } from '@/components/meal-card';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { WorkoutCard } from '@/components/workout-card';
import { canAddWorkoutOn, localDateOf } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday, formatTimeOfDay } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

// The YYYY-MM-DD local date `by` days after this one, or before it.
function shiftDay(localDate: string, by: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return localDateOf(new Date(year, month - 1, day + by));
}

// What was recorded on one local date, opened from the History calendar: a
// section for each kind of record. Arrows in the header step a day either way.
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const today = useToday();
  const day = useTrackerQuery(() => tracker.getDay(date), [date]);
  const workoutInProgress = useWorkoutInProgress();
  const canAdd = canAddWorkoutOn(date, new Date());

  async function addWorkout() {
    if (
      await runOrAlert("Couldn't add a workout", () => tracker.startWorkout({ localDate: date }))
    ) {
      router.push('/workout');
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: formatLocalDateWithWeekday(date),
          headerRight: () => (
            <View style={styles.stepper}>
              <IconButton
                icon="chevron-back"
                label="Day before"
                onPress={() => router.setParams({ date: shiftDay(date, -1) })}
              />
              <IconButton
                icon="chevron-forward"
                label="Day after"
                // Dates compare in order as text; nothing's recorded ahead of today.
                disabled={date >= today}
                onPress={() => router.setParams({ date: shiftDay(date, 1) })}
              />
            </View>
          ),
        }}
      />
      {day && (
        <Section title="Workouts">
          {day.workouts.length === 0 && (
            <AppText tone="muted" style={styles.note}>
              No workouts.
            </AppText>
          )}
          {day.workouts.map(workout => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              // navigate, not push, so a double tap can't open it twice.
              onPress={() =>
                router.navigate({ pathname: '/workout/[id]', params: { id: workout.id } })
              }
            />
          ))}
          {canAdd && workoutInProgress === null && (
            <Button variant="secondary" icon="add" label="Add workout" onPress={addWorkout} />
          )}
          {/* One Workout at a time, so a backfill waits for the one in progress.
              The Workout bar is on the tabs, so this is the way back to it. */}
          {canAdd && workoutInProgress && (
            <Card>
              <AppText tone="muted">Finish the workout in progress to add one to this day.</AppText>
              <Button
                variant="tonal"
                icon="barbell-outline"
                label="Go to the workout in progress"
                onPress={() => router.navigate('/workout')}
              />
            </Card>
          )}
        </Section>
      )}
      {day && (
        <Section title="Meals">
          {day.meals.length === 0 && (
            <AppText tone="muted" style={styles.note}>
              No meals.
            </AppText>
          )}
          {day.meals.map(meal => (
            <MealCard
              key={meal.id}
              meal={meal}
              onPress={() => router.navigate({ pathname: '/meals/[id]', params: { id: meal.id } })}
            />
          ))}
        </Section>
      )}
      {day && (
        <Section title="Weigh-in">
          {day.weighIn ? (
            <Card style={styles.weighIn}>
              <AppText variant="heading">{formatBodyWeight(day.weighIn.displayWeight)}</AppText>
              <AppText variant="caption" tone="muted">
                at {formatTimeOfDay(day.weighIn.weighedAt)}
              </AppText>
            </Card>
          ) : (
            <AppText tone="muted" style={styles.note}>
              No weigh-in.
            </AppText>
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    marginRight: -space.sm,
  },
  note: {
    paddingHorizontal: space.xs,
  },
  weighIn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
});
