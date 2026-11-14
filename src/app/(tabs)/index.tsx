import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DailyTotalsCard } from '@/components/daily-totals-card';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { WeighInCard } from '@/components/weigh-in-card';
import type { Template } from '@/core/tracker';
import { tracker } from '@/database';
import { hasMacroTargets } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { exerciseList } from '@/template-labels';
import { radius, space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

// Today at a glance, on one screen: what to train, what's been eaten against
// the day's targets, and today's weight.
export default function TodayScreen() {
  const router = useRouter();
  const workoutInProgress = useWorkoutInProgress();
  const templates = useTrackerQuery(() => tracker.getTemplates(), []);
  // Null once loaded with no active Rotation, or an empty one.
  const nextUp = useTrackerQuery(() => tracker.getNextUp(), []);
  const today = useToday();
  const dailyTotals = useTrackerQuery(() => tracker.getDailyTotals(today), [today]);
  // Null once loaded with no Weigh-in today.
  const weighIn = useTrackerQuery(() => tracker.getWeighIn(today), [today]);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  async function start(templateId?: string) {
    const started = await runOrAlert("Couldn't start the workout", () =>
      tracker.startWorkout({ templateId }),
    );
    if (started) router.push('/workout');
  }

  return (
    <Screen onTab contentStyle={styles.content}>
      {/* Only one Workout can be in progress; while one is, the Workout bar
          returns to it. */}
      {workoutInProgress === null && templates && nextUp !== undefined && (
        <>
          {nextUp && <NextUp template={nextUp} onStart={() => start(nextUp.id)} />}
          <Section
            title="Start a workout"
            action={
              templates.length > 0
                ? { label: 'Templates', onPress: () => router.navigate('/templates') }
                : undefined
            }
          >
            {/* One row whatever the number of Templates: it scrolls sideways. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillBar}
              contentContainerStyle={styles.pills}
            >
              {templates.map(template => (
                <Button
                  key={template.id}
                  variant="tonal"
                  icon="play"
                  label={template.name}
                  accessibilityLabel={`Start ${template.name}`}
                  accessibilityHint={exerciseList(template)}
                  // Guarded by the button: a double tap starts one Workout.
                  onPress={() => start(template.id)}
                  style={styles.pill}
                />
              ))}
              <Button
                variant={templates.length === 0 ? 'primary' : 'secondary'}
                icon="add"
                label="Empty workout"
                accessibilityLabel="Start empty workout"
                onPress={() => start()}
                style={styles.pill}
              />
              {templates.length === 0 && (
                <Button
                  variant="secondary"
                  icon="list"
                  label="Create a template"
                  onPress={() => router.navigate('/templates/new')}
                  style={styles.pill}
                />
              )}
              {/* Next up comes from the active Rotation; point the way to one. */}
              {!nextUp && templates.length > 1 && (
                <Button
                  variant="secondary"
                  icon="repeat"
                  label="Set up a rotation"
                  onPress={() => router.navigate('/rotations')}
                  style={styles.pill}
                />
              )}
            </ScrollView>
          </Section>
        </>
      )}
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
  template: Template;
  onStart: () => Promise<void>;
};

// The active Rotation's next-up Template, to start with one tap.
function NextUp({ template, onStart }: NextUpProps) {
  return (
    <Card style={styles.nextUp}>
      <View style={styles.nextUpText}>
        <AppText accessibilityRole="header" variant="overline" tone="primary">
          Next up
        </AppText>
        <AppText variant="heading" numberOfLines={1}>
          {template.name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {exerciseList(template)}
        </AppText>
      </View>
      <Button
        icon="play"
        label="Start"
        accessibilityLabel={`Start ${template.name}`}
        onPress={onStart}
        style={styles.start}
      />
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
  // Runs to the screen's edges, so the row scrolls under them.
  pillBar: {
    marginHorizontal: -space.lg,
    flexGrow: 0,
  },
  pills: {
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  pill: {
    borderRadius: radius.pill,
  },
});
