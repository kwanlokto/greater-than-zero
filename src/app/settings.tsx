import { useRouter } from 'expo-router';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { UnitPicker } from '@/components/unit-picker';
import { tracker } from '@/database';
import { formatCalories, formatGrams } from '@/food-labels';
import { importBackupFromFile } from '@/import-backup-file';
import { runOrAlert } from '@/run-or-alert';
import { shareBackup } from '@/share-backup';
import { useTrackerQuery } from '@/use-tracker-query';

export default function SettingsScreen() {
  const router = useRouter();
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);
  const targets = useTrackerQuery(() => tracker.getMacroTargets(), []);
  const templates = useTrackerQuery(() => tracker.getTemplates(), []);
  const rotations = useTrackerQuery(() => tracker.getRotations(), []);
  const activeRotation = rotations?.find(rotation => rotation.isActive);

  const targetSummary =
    targets &&
    [
      targets.calories !== null && `${formatCalories(targets.calories)} kcal`,
      targets.protein !== null && `P ${formatGrams(targets.protein)} g`,
      targets.carbs !== null && `C ${formatGrams(targets.carbs)} g`,
      targets.fat !== null && `F ${formatGrams(targets.fat)} g`,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen>
      <Section title="Display unit">
        <UnitPicker value={displayUnit} onChange={unit => tracker.setDisplayUnit(unit)} />
      </Section>
      <Section title="Training">
        <ListGroup>
          <ListRow
            icon="list"
            title="Templates"
            subtitle={
              templates && (templates.length === 1 ? '1 template' : `${templates.length} templates`)
            }
            onPress={() => router.navigate('/templates')}
          />
          <ListRow
            icon="repeat"
            title="Rotations"
            subtitle={
              rotations && (activeRotation ? `${activeRotation.name} is active` : 'None active')
            }
            onPress={() => router.navigate('/rotations')}
          />
          <ListRow
            icon="barbell"
            title="Exercise library"
            subtitle="Rest times and your own exercises"
            onPress={() => router.navigate('/exercises')}
          />
        </ListGroup>
      </Section>
      <Section title="Food">
        <ListGroup>
          <ListRow
            icon="nutrition"
            title="Macro targets"
            subtitle={targets && (targetSummary || 'Not set')}
            onPress={() => router.navigate('/macro-targets')}
          />
          <ListRow
            icon="bookmark"
            title="Saved foods"
            subtitle="Foods you eat often"
            onPress={() => router.navigate('/saved-foods')}
          />
        </ListGroup>
      </Section>
      <Section title="Backup">
        <Card>
          <AppText tone="muted">
            Save all your data to a file you can keep in Drive or send by email, and bring it back
            on a new phone.
          </AppText>
          <Button
            icon="share-outline"
            label="Export backup"
            onPress={async () => {
              await runOrAlert("Couldn't export the backup", shareBackup);
            }}
            style={{ marginTop: 8 }}
          />
          <Button
            variant="secondary"
            icon="download-outline"
            label="Import backup"
            onPress={async () => {
              await runOrAlert("Couldn't import the backup", importBackupFromFile);
            }}
          />
        </Card>
      </Section>
    </Screen>
  );
}
