import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { describeChart } from '@/chart-labels';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { LineChart } from '@/components/line-chart';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { formatWeight, type Exercise } from '@/core/tracker';
import { tracker } from '@/database';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// How many Exercises the tab shows: the most recently done, two to a row, by
// name. The rest are a tap away, so the tab fits on one screen.
const exercisesShown = 6;

// The body-weight trend, then the Exercises most recently done, to chart.
export default function ProgressScreen() {
  const router = useRouter();
  const trend = useTrackerQuery(() => tracker.getBodyWeightTrend(), []);
  const exercises = useTrackerQuery(() => tracker.getProgressExercises(), []);
  const trendPoints = trend
    ? trend.points.map(point => ({
        ...point,
        label: formatWeight({ value: point.displayValue, unit: trend.unit }),
      }))
    : [];

  const openChart = (exercise: Exercise) =>
    // navigate, not push, so a double tap can't open it twice.
    router.navigate({ pathname: '/progress/[exerciseId]', params: { exerciseId: exercise.id } });

  return (
    <Screen onTab contentStyle={styles.content}>
      {trend && (
        <Section
          title="Body weight"
          action={
            trendPoints.length > 0
              ? { label: 'All weigh-ins', onPress: () => router.navigate('/weigh-ins') }
              : undefined
          }
        >
          <Card>
            {trendPoints.length === 0 ? (
              <EmptyState
                icon="scale-outline"
                title="No weigh-ins yet"
                message="Record one on Today to see your body-weight trend."
                action={{ label: 'Go to Today', onPress: () => router.navigate('/') }}
              />
            ) : (
              <LineChart
                points={trendPoints}
                height={150}
                description={describeChart(
                  'Body weight',
                  { one: 'weigh-in', many: 'weigh-ins' },
                  trendPoints,
                )}
              />
            )}
          </Card>
        </Section>
      )}
      {exercises && (
        <Section
          title="Exercises"
          action={
            exercises.length > exercisesShown
              ? {
                  label: `All ${exercises.length}`,
                  onPress: () => router.navigate('/progress/all'),
                }
              : undefined
          }
        >
          {exercises.length === 0 ? (
            <Card>
              <EmptyState
                icon="barbell-outline"
                title="Nothing to chart yet"
                message="Finish a workout to see how each exercise progresses."
              />
            </Card>
          ) : (
            <View style={styles.grid}>
              {exercises.slice(0, exercisesShown).map(exercise => (
                <Card
                  key={exercise.id}
                  onPress={() => openChart(exercise)}
                  accessibilityHint="Opens its progress chart"
                  style={styles.tile}
                >
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {exercise.name}
                  </AppText>
                </Card>
              ))}
            </View>
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  // Two to a row, each tall enough for a name on two lines.
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 68,
    justifyContent: 'center',
    paddingVertical: space.md,
  },
});
