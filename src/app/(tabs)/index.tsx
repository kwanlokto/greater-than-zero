import { Link, useRouter, useTheme } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import type { Template } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { exerciseCount } from '@/template-labels';
import { useGuardedPress } from '@/use-guarded-press';
import { useTrackerQuery } from '@/use-tracker-query';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const workoutInProgress = useWorkoutInProgress();
  const templates = useTrackerQuery(() => tracker.getTemplates(), []);

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
          <PrimaryButton label="Start empty workout" onPress={() => start()} />
          <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.text }]}>Start from template</Text>
            {templates?.length === 0 && (
              <Text style={[styles.faint, { color: colors.text }]}>
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
      <Text style={[styles.placeholder, { color: colors.text }]}>
        Your next-up workout, today's food and today's weigh-in will show here.
      </Text>
    </ScrollView>
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
      disabled={busy}
      onPress={press}
      style={[styles.template, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text style={[styles.templateName, { color: colors.text }]}>{template.name}</Text>
      <Text style={[styles.faint, { color: colors.text }]}>
        {template.exercises.map(({ exercise }) => exercise.name).join(', ') ||
          exerciseCount(0)}
      </Text>
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
  templateName: {
    fontSize: 16,
    fontWeight: '600',
  },
  faint: {
    fontSize: 14,
    opacity: 0.7,
  },
  placeholder: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
