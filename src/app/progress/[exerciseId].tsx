import { Stack, useLocalSearchParams, useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { OptionPicker } from '@/components/option-picker';
import { progressMeasuresFor, type ProgressMeasure } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDate, formatLocalDateWithWeekday } from '@/dates';
import { formatProgressValue, measureName, measureNamesFor } from '@/progress-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// How an Exercise has progressed: a chart of one value per finished Workout,
// switchable between its two measures, and the same values listed below it.
export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { colors } = useTheme();
  const exercise = useTrackerQuery(
    async () => (await tracker.getExercise(exerciseId)) ?? null,
    [exerciseId],
  );
  const [chosen, setChosen] = useState<ProgressMeasure>();
  const measure = chosen ?? (exercise ? progressMeasuresFor[exercise.trackingType][0] : undefined);
  const series = useTrackerQuery(
    async () => (measure ? tracker.getProgress(exerciseId, measure) : null),
    [exerciseId, measure],
  );

  if (exercise === undefined || series === undefined) return null;
  if (exercise === null || measure === undefined || series === null) {
    return <Text style={[styles.message, { color: colors.text }]}>No such exercise.</Text>;
  }

  const { trackingType } = exercise;
  const { unit, points } = series;
  const format = (value: number) => formatProgressValue(unit, value);
  const latestFirst = [...points].reverse();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: exercise.name }} />
      <OptionPicker
        options={progressMeasuresFor[trackingType]}
        labels={measureNamesFor(trackingType)}
        value={measure}
        onChange={setChosen}
      />
      {points.length === 0 ? (
        <Text style={[styles.message, { color: colors.text }]}>
          No finished workouts with it yet.
        </Text>
      ) : (
        <>
          <LineChart
            points={points}
            formatValue={format}
            wholeNumbers={unit === 'reps'}
            description={describeChart(measureName(trackingType, measure), points, format)}
          />
          <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.text }]}>Each workout</Text>
            {latestFirst.map(point => (
              <View
                key={point.workoutId}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text style={[styles.rowDate, { color: colors.text }]}>
                  {formatLocalDateWithWeekday(point.localDate)}
                </Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{format(point.value)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// "Estimated 1-rep max over 3 workouts, from 116.7 kg on 20 Sep to 130 kg on
// 24 Sep", for screen readers.
function describeChart(
  name: string,
  points: { localDate: string; value: number }[],
  format: (value: number) => string,
): string {
  const first = points[0];
  const last = points[points.length - 1];
  const workouts = points.length === 1 ? '1 workout' : `${points.length} workouts`;
  return (
    `${name} over ${workouts}, from ${format(first.value)} on ${formatLocalDate(first.localDate)} ` +
    `to ${format(last.value)} on ${formatLocalDate(last.localDate)}`
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 4,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowDate: {
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
