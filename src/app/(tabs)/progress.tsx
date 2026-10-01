import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useTheme } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { describeTrend, formatBodyWeight } from '@/body-weight-labels';
import { LineChart } from '@/components/line-chart';
import { TextButton } from '@/components/text-button';
import { tracker } from '@/database';
import { exerciseDetails } from '@/exercise-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// The body-weight trend, then the Exercises to chart: those with a working Set
// in a finished Workout, the most recently done first.
export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const trend = useTrackerQuery(() => tracker.getBodyWeightTrend(), []);
  const exercises = useTrackerQuery(() => tracker.getProgressExercises(), []);

  return (
    <FlatList
      data={exercises ?? []}
      keyExtractor={exercise => exercise.id}
      ListHeaderComponent={
        <>
          <Text style={[styles.heading, { color: colors.text }]}>Body weight</Text>
          <View style={styles.bodyWeight}>
            {trend && trend.points.length === 0 && (
              <Text style={[styles.note, { color: colors.text }]}>
                Record a weigh-in on Today to see your body-weight trend.
              </Text>
            )}
            {trend && trend.points.length > 0 && (
              <>
                <LineChart
                  points={trend.points.map(point => ({
                    ...point,
                    label: formatBodyWeight(point.displayValue, trend.unit),
                  }))}
                  description={describeTrend(trend)}
                />
                <TextButton label="All weigh-ins" onPress={() => router.navigate('/weigh-ins')} />
              </>
            )}
          </View>
          <Text style={[styles.heading, { color: colors.text }]}>Exercises</Text>
        </>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens its progress chart"
          // navigate, not push, so a double tap can't open it twice.
          onPress={() =>
            router.navigate({ pathname: '/progress/[exerciseId]', params: { exerciseId: item.id } })
          }
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.details, { color: colors.text }]}>{exerciseDetails(item)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      )}
      ListEmptyComponent={
        exercises && (
          <Text style={[styles.empty, { color: colors.text }]}>
            Finish a workout to see how each exercise progresses.
          </Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  bodyWeight: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  note: {
    fontSize: 14,
    opacity: 0.7,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  details: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
