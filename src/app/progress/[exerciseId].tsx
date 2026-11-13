import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { describeChart } from '@/chart-labels';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { LineChart } from '@/components/line-chart';
import { ListGroup, ListRow } from '@/components/list-row';
import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { progressMeasuresFor, type ProgressMeasure } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { formatProgressValue, measureNames } from '@/progress-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// How an Exercise has progressed: a chart of one value per finished Workout,
// switchable between its two measures, and the same values listed below it.
export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
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
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="No such exercise." />
      </Screen>
    );
  }

  const { trackingType } = exercise;
  const { unit, points } = series;
  const chartPoints = points.map(point => ({
    ...point,
    label: formatProgressValue(unit, point.displayValue),
  }));
  const latestFirst = [...chartPoints].reverse();

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <OptionPicker
        options={progressMeasuresFor[trackingType]}
        labels={measureNames[trackingType]}
        value={measure}
        onChange={setChosen}
      />
      {points.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="No finished workouts with it yet." />
      ) : (
        <>
          <Card>
            <LineChart
              points={chartPoints}
              wholeNumbers={unit === 'reps'}
              description={describeChart(
                measureNames[trackingType][measure],
                { one: 'workout', many: 'workouts' },
                chartPoints,
              )}
            />
          </Card>
          <Section title="Each workout">
            <ListGroup>
              {latestFirst.map(point => (
                <ListRow
                  key={point.workoutId}
                  title={formatLocalDateWithWeekday(point.localDate)}
                  value={point.label}
                  valueTone="primary"
                />
              ))}
            </ListGroup>
          </Section>
        </>
      )}
    </Screen>
  );
}
