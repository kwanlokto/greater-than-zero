import { useRouter } from 'expo-router';

import { AppText } from '@/components/app-text';
import { MacroTargetsForm } from '@/components/macro-targets-form';
import { Screen } from '@/components/screen';
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
    <Screen>
      <AppText tone="muted">Today and the Food tab measure each day's food against these.</AppText>
      <MacroTargetsForm initial={targets} submitLabel="Save targets" onSubmit={save} />
    </Screen>
  );
}
