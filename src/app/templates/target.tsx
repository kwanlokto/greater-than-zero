import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { TargetForm } from '@/components/target-form';
import type { TargetValues } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Either an Exercise being added to the Template (exerciseId) or one already
// in it whose Target is changing (templateExerciseId).
type Params = { templateId: string; exerciseId?: string; templateExerciseId?: string };

// The Target for one Exercise in a Template.
export default function TargetScreen() {
  const { templateId, exerciseId, templateExerciseId } = useLocalSearchParams<Params>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's nothing to set a Target for, e.g. after the Template or
  // this Exercise in it is removed.
  const loaded = useTrackerQuery(async () => {
    if (templateExerciseId) {
      const template = await tracker.getTemplate(templateId);
      const existing = template?.exercises.find(({ id }) => id === templateExerciseId);
      return existing ? { exercise: existing.exercise, initial: existing.target } : null;
    }
    const template = await tracker.getTemplate(templateId);
    const exercise = exerciseId ? await tracker.getExercise(exerciseId) : undefined;
    if (!template || !exercise) return null;
    return { exercise, initial: { weightUnit: await tracker.getDisplayUnit() } };
  }, [templateId, exerciseId, templateExerciseId]);

  if (loaded === undefined) return null;
  if (loaded === null) {
    return (
      <Text style={[styles.message, { color: colors.text }]}>
        This exercise is no longer in the template.
      </Text>
    );
  }

  const { exercise } = loaded;

  async function save(target: TargetValues) {
    const saved = await runOrAlert("Couldn't save the target", async () => {
      if (templateExerciseId) await tracker.editTarget(templateExerciseId, target);
      else await tracker.addExerciseToTemplate(templateId, exercise.id, target);
    });
    if (saved) router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: exercise.name }} />
      <TargetForm
        trackingType={exercise.trackingType}
        initial={loaded.initial}
        submitLabel={templateExerciseId ? 'Save' : 'Add to template'}
        onSubmit={save}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
