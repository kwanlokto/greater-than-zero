import { Stack, useLocalSearchParams, useTheme } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { WorkoutCard } from '@/components/workout-card';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { useTrackerQuery } from '@/use-tracker-query';

// What was recorded on one local date, opened from the History calendar: a
// section for each kind of record.
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { colors } = useTheme();
  const day = useTrackerQuery(() => tracker.getDay(date), [date]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: formatLocalDateWithWeekday(date) }} />
      {day && (
        <DaySection title="Workouts">
          {day.workouts.length === 0 ? (
            <Text style={[styles.empty, { color: colors.text }]}>No workouts.</Text>
          ) : (
            day.workouts.map(workout => <WorkoutCard key={workout.id} workout={workout} />)
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
  empty: {
    fontSize: 16,
    opacity: 0.7,
  },
});
