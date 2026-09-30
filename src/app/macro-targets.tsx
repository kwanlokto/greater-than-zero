import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { MacroTargetsForm } from '@/components/macro-targets-form';
import type { MacroTargets } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Changes the Macro targets Today measures each day's food against.
export default function MacroTargetsScreen() {
  const router = useRouter();
  const targets = useTrackerQuery(() => tracker.getMacroTargets(), []);

  if (targets === undefined) return null;

  async function save(changed: MacroTargets) {
    if (await runOrAlert("Couldn't save the targets", () => tracker.setMacroTargets(changed))) {
      router.back();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <MacroTargetsForm initial={targets} submitLabel="Save targets" onSubmit={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
