import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

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
  const loaded = useTrackerQuery(async () => {
    if (templateExerciseId) {
      const template = await tracker.getTemplate(templateId);
      const existing = template?.exercises.find(({ id }) => id === templateExerciseId);
      return existing && { exercise: existing.exercise, initial: existing.target };
    }
    const exercise = exerciseId ? await tracker.getExercise(exerciseId) : undefined;
    return exercise && { exercise, initial: { weightUnit: await tracker.getDisplayUnit() } };
  }, [templateId, exerciseId, templateExerciseId]);

  if (!loaded) return null;

  async function save(target: TargetValues) {
    const saved = await runOrAlert("Couldn't save the target", async () => {
      if (templateExerciseId) await tracker.editTarget(templateExerciseId, target);
      else await tracker.addExerciseToTemplate(templateId, loaded!.exercise.id, target);
    });
    if (saved) router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: loaded.exercise.name }} />
      <TargetForm
        trackingType={loaded.exercise.trackingType}
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
});
