import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DailyTotalsCard } from '@/components/daily-totals-card';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { WeighInCard } from '@/components/weigh-in-card';
import type { Template } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { hasMacroTargets } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { exerciseList } from '@/template-labels';
import { space, useAppTheme } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
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
    <Screen onTab>
      <AppText tone="muted" style={styles.date}>
        {formatLocalDateWithWeekday(today)}
      </AppText>
      {/* Only one Workout can be in progress; while one is, the Workout bar
          returns to it. */}
      {workoutInProgress === null && templates && nextUp !== undefined && (
        <>
          {nextUp && <NextUp template={nextUp} onStart={() => start(nextUp.id)} />}
          <Section
            title="Start from template"
            action={
              templates.length > 0
                ? { label: 'Manage', onPress: () => router.navigate('/templates') }
                : undefined
            }
          >
            {templates.length === 0 ? (
              <Card>
                <AppText variant="bodyStrong">No templates yet.</AppText>
                <AppText tone="muted">
                  A template is a workout you repeat, with a target for each exercise.
                </AppText>
                <Button
                  variant="tonal"
                  icon="add"
                  label="Create one"
                  onPress={() => router.navigate('/templates/new')}
                  style={styles.cardAction}
                />
              </Card>
            ) : (
              <ListGroup>
                {templates.map(template => (
                  <ListRow
                    key={template.id}
                    title={template.name}
                    subtitle={exerciseList(template)}
                    subtitleLines={1}
                    accessibilityLabel={`Start ${template.name}`}
                    trailing={<Ionicons name="play-circle" size={32} color={colors.primary} />}
                    // Guarded by the row: a double tap starts one Workout.
                    onPress={() => start(template.id)}
                  />
                ))}
                {/* Next up comes from the active Rotation; point the way to one. */}
                {!nextUp && templates.length > 1 && (
                  <ListRow
                    icon="repeat"
                    title="Set up a rotation"
                    subtitle="Today then shows which template is next up"
                    onPress={() => router.navigate('/rotations')}
                  />
                )}
              </ListGroup>
            )}
            <Button
              variant={nextUp ? 'secondary' : 'primary'}
              icon="add"
              label="Start empty workout"
              onPress={() => start()}
            />
          </Section>
        </>
      )}
      {dailyTotals && (
        <Section
          title="Today's food"
          action={{ label: 'Meals', onPress: () => router.navigate('/food') }}
        >
          <DailyTotalsCard
            totals={dailyTotals}
            hint="Opens today's meals"
            onPress={() => router.navigate('/food')}
          />
          {!hasMacroTargets(dailyTotals) && (
            <Button
              variant="ghost"
              label="Set daily targets"
              onPress={() => router.navigate('/macro-targets')}
            />
          )}
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
            onSave={weight =>
              runOrAlert("Couldn't save the weigh-in", () => tracker.setWeighIn(weight))
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
      <AppText accessibilityRole="header" variant="overline" tone="primary">
        Next up
      </AppText>
      <AppText variant="title">{template.name}</AppText>
      <AppText tone="muted" numberOfLines={2}>
        {exerciseList(template)}
      </AppText>
      <Button
        size="large"
        icon="play"
        label={`Start ${template.name}`}
        onPress={onStart}
        style={styles.cardAction}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  date: {
    marginTop: -space.sm,
    marginBottom: -space.sm,
    paddingHorizontal: space.xs,
  },
  nextUp: {
    gap: space.xs,
    padding: space.xl,
  },
  cardAction: {
    marginTop: space.md,
  },
});
