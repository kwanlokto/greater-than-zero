import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBodyWeight } from '@/body-weight-labels';
import { MealCard } from '@/components/meal-card';
import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import { WorkoutCard } from '@/components/workout-card';
import { canAddWorkoutOn } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

// What was recorded on one local date, opened from the History calendar: a
// section for each kind of record.
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const day = useTrackerQuery(() => tracker.getDay(date), [date]);
  const workoutInProgress = useWorkoutInProgress();
  const canAdd = canAddWorkoutOn(date, new Date());

  async function addWorkout() {
    if (await runOrAlert("Couldn't add a workout", () => tracker.startWorkout({ localDate: date }))) {
      router.push('/workout');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: formatLocalDateWithWeekday(date) }} />
      {day && (
        <DaySection title="Workouts">
          {day.workouts.length === 0 && (
            <Text style={[styles.note, { color: colors.text }]}>No workouts.</Text>
          )}
          {day.workouts.map(workout => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              // navigate, not push, so a double tap can't open it twice.
              onPress={() => router.navigate({ pathname: '/workout/[id]', params: { id: workout.id } })}
            />
          ))}
          {canAdd && workoutInProgress === null && (
            <PrimaryButton label="Add workout" onPress={addWorkout} />
          )}
          {/* One Workout at a time, so a backfill waits for the one in progress.
              The Workout bar is on the tabs, so this is the way back to it. */}
          {canAdd && workoutInProgress && (
            <>
              <Text style={[styles.note, { color: colors.text }]}>
                Finish the workout in progress to add one to this day.
              </Text>
              <TextButton
                label="Go to the workout in progress"
                onPress={() => router.navigate('/workout')}
              />
            </>
          )}
        </DaySection>
      )}
      {day && (
        <DaySection title="Meals">
          {day.meals.length === 0 && (
            <Text style={[styles.note, { color: colors.text }]}>No meals.</Text>
          )}
          {day.meals.map(meal => (
            <MealCard
              key={meal.id}
              meal={meal}
              onPress={() => router.navigate({ pathname: '/meals/[id]', params: { id: meal.id } })}
            />
          ))}
        </DaySection>
      )}
      {day && (
        <DaySection title="Weigh-in">
          {day.weighIn ? (
            <Text style={[styles.weighIn, { color: colors.text }]}>
              {formatBodyWeight(day.weighIn.displayWeight.value, day.weighIn.displayWeight.unit)}
            </Text>
          ) : (
            <Text style={[styles.note, { color: colors.text }]}>No weigh-in.</Text>
          )}
        </DaySection>
      )}
    </ScrollView>
  );
}

function DaySection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
  },
  note: {
    fontSize: 16,
    opacity: 0.7,
  },
  weighIn: {
    fontSize: 16,
    fontWeight: '600',
  },
});
