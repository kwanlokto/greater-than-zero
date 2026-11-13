import { useRouter } from 'expo-router';

import { formatBodyWeight } from '@/body-weight-labels';
import { describeChart } from '@/chart-labels';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { LineChart } from '@/components/line-chart';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { tracker } from '@/database';
import { exerciseDetails } from '@/exercise-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// The body-weight trend, then the Exercises to chart: those with a working Set
// in a finished Workout, the most recently done first.
export default function ProgressScreen() {
  const router = useRouter();
  const trend = useTrackerQuery(() => tracker.getBodyWeightTrend(), []);
  const exercises = useTrackerQuery(() => tracker.getProgressExercises(), []);
  const trendPoints = trend
    ? trend.points.map(point => ({
        ...point,
        label: formatBodyWeight({ value: point.displayValue, unit: trend.unit }),
      }))
    : [];

  return (
    <Screen onTab>
      {trend && (
        <Section
          title="Body weight"
          action={
            trendPoints.length > 0
              ? { label: 'All weigh-ins', onPress: () => router.navigate('/weigh-ins') }
              : undefined
          }
        >
          {trendPoints.length === 0 ? (
            <Card>
              <EmptyState
                icon="scale-outline"
                title="No weigh-ins yet"
                message="Record one on Today to see your body-weight trend."
                action={{ label: 'Go to Today', onPress: () => router.navigate('/') }}
              />
            </Card>
          ) : (
            <Card>
              <LineChart
                points={trendPoints}
                description={describeChart(
                  'Body weight',
                  { one: 'weigh-in', many: 'weigh-ins' },
                  trendPoints,
                )}
              />
            </Card>
          )}
        </Section>
      )}
      {exercises && (
        <Section title="Exercises">
          {exercises.length === 0 ? (
            <Card>
              <EmptyState
                icon="barbell-outline"
                title="Nothing to chart yet"
                message="Finish a workout to see how each exercise progresses."
              />
            </Card>
          ) : (
            <ListGroup>
              {exercises.map(exercise => (
                <ListRow
                  key={exercise.id}
                  title={exercise.name}
                  subtitle={exerciseDetails(exercise)}
                  accessibilityHint="Opens its progress chart"
                  // navigate, not push, so a double tap can't open it twice.
                  onPress={() =>
                    router.navigate({
                      pathname: '/progress/[exerciseId]',
                      params: { exerciseId: exercise.id },
                    })
                  }
                />
              ))}
            </ListGroup>
          )}
        </Section>
      )}
    </Screen>
  );
}
