import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { UnitPicker } from '@/components/unit-picker';
import { tracker } from '@/database';
import { formatCalories, formatGrams } from '@/food-labels';
import { importBackupFromFile } from '@/import-backup-file';
import { runOrAlert } from '@/run-or-alert';
import { shareBackup } from '@/share-backup';
import { space } from '@/theme';
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
      // Wrapped, if at all, between targets: never inside one.
      .map(part => part && part.replace(/ /g, '\u00a0'))
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen contentStyle={styles.content}>
      <ListGroup>
        <ListRow
          icon="scale"
          title="Weight unit"
          trailing={
            <UnitPicker
              compact
              value={displayUnit}
              onChange={unit =>
                runOrAlert("Couldn't change the weight unit", () => tracker.setDisplayUnit(unit))
              }
            />
          }
        />
      </ListGroup>
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
        <AppText variant="caption" tone="muted" style={styles.note}>
          All your data in one file, to keep in Drive or email and restore on a new phone.
        </AppText>
        <View style={styles.backup}>
          <Button
            icon="share-outline"
            label="Export"
            accessibilityLabel="Export backup"
            onPress={async () => {
              await runOrAlert("Couldn't export the backup", shareBackup);
            }}
            style={styles.flex}
          />
          <Button
            variant="secondary"
            icon="download-outline"
            label="Import"
            accessibilityLabel="Import backup"
            onPress={async () => {
              await runOrAlert("Couldn't import the backup", importBackupFromFile);
            }}
            style={styles.flex}
          />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
  },
  note: {
    paddingHorizontal: space.xs,
  },
  backup: {
    flexDirection: 'row',
    gap: space.md,
  },
  flex: {
    flex: 1,
  },
});
