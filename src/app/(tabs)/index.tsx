import { Link, useRouter, useTheme } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DailyTotalsCard } from '@/components/daily-totals-card';
import { PrimaryButton } from '@/components/primary-button';
import { WeighInCard } from '@/components/weigh-in-card';
import type { Template } from '@/core/tracker';
import { tracker } from '@/database';
import { hasMacroTargets } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { exerciseList } from '@/template-labels';
import { useGuardedPress } from '@/use-guarded-press';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const workoutInProgress = useWorkoutInProgress();
  const templates = useTrackerQuery(() => tracker.getTemplates(), []);
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
    <ScrollView contentContainerStyle={styles.container}>
      {/* Only one Workout can be in progress; while one is, the Workout bar
          returns to it. */}
      {workoutInProgress === null && (
        <>
          {nextUp && <NextUp template={nextUp} onStart={() => start(nextUp.id)} />}
          <PrimaryButton label="Start empty workout" onPress={() => start()} />
          <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.text }]}>Start from template</Text>
            {templates?.length === 0 && (
              <Text style={[styles.details, { color: colors.text }]}>
                No templates yet.{' '}
                <Link href="/templates" style={{ color: colors.primary }}>
                  Create one
                </Link>
              </Text>
            )}
            {templates?.map(template => (
              <TemplateButton
                key={template.id}
                template={template}
                onPress={() => start(template.id)}
              />
            ))}
          </View>
        </>
      )}
      {dailyTotals && (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>Today's food</Text>
          <DailyTotalsCard
            totals={dailyTotals}
            hint="Opens today's meals"
            onPress={() => router.navigate('/food')}
          />
          {!hasMacroTargets(dailyTotals) && (
            <Link href="/macro-targets" style={[styles.details, { color: colors.primary }]}>
              Set daily targets
            </Link>
          )}
        </View>
      )}
      {weighIn !== undefined && displayUnit && (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>Today's weigh-in</Text>
          <WeighInCard
            weighIn={weighIn}
            displayUnit={displayUnit}
            onSave={weight =>
              runOrAlert("Couldn't save the weigh-in", () => tracker.setWeighIn(weight))
            }
          />
        </View>
      )}
    </ScrollView>
  );
}

type NextUpProps = {
  template: Template;
  onStart: () => Promise<void>;
};

// The active Rotation's next-up Template, to start with one tap.
function NextUp({ template, onStart }: NextUpProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Next up</Text>
      <View style={[styles.template, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{template.name}</Text>
        <Text style={[styles.details, { color: colors.text }]}>{exerciseList(template)}</Text>
        <View style={styles.startNextUp}>
          <PrimaryButton label={`Start ${template.name}`} onPress={onStart} />
        </View>
      </View>
    </View>
  );
}

type TemplateButtonProps = {
  template: Template;
  onPress: () => Promise<void>;
};

function TemplateButton({ template, onPress }: TemplateButtonProps) {
  const { colors } = useTheme();
  // A double tap starts one Workout, not an error about the first.
  const { press, busy } = useGuardedPress(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start ${template.name}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={press}
      style={[
        styles.template,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: busy ? 0.4 : 1 },
      ]}
    >
      <Text style={[styles.heading, { color: colors.text }]}>{template.name}</Text>
      <Text style={[styles.details, { color: colors.text }]}>{exerciseList(template)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
    justifyContent: 'center',
  },
  section: {
    gap: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
  },
  template: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  details: {
    fontSize: 14,
    opacity: 0.7,
  },
  startNextUp: {
    marginTop: 8,
  },
});
