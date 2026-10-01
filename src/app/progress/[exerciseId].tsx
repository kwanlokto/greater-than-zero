import { Stack, useLocalSearchParams, useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { OptionPicker } from '@/components/option-picker';
import { progressMeasuresFor, type ProgressMeasure } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { describeProgress, formatProgressValue, measureNames } from '@/progress-labels';
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
  const chartPoints = points.map(point => ({
    ...point,
    label: formatProgressValue(unit, point.displayValue),
  }));
  const latestFirst = [...chartPoints].reverse();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: exercise.name }} />
      <OptionPicker
        options={progressMeasuresFor[trackingType]}
        labels={measureNames[trackingType]}
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
            points={chartPoints}
            wholeNumbers={unit === 'reps'}
            description={describeProgress(measureNames[trackingType][measure], series)}
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
                <Text style={[styles.rowValue, { color: colors.text }]}>{point.label}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
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
