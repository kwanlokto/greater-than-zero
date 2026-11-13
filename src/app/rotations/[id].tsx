import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { NameField } from '@/components/name-field';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { Toggle } from '@/components/toggle';
import type { Rotation, RotationEntry } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { space, useAppTheme } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// One Rotation: its name, whether it's the active one, and its Templates in
// the order they come up. Every change is saved as it's made.
export default function RotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Null once there's no such Rotation, e.g. after it's deleted.
  const rotation = useTrackerQuery(async () => (await tracker.getRotation(id)) ?? null, [id]);

  if (rotation === undefined) return null;
  if (rotation === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This rotation was deleted." />
      </Screen>
    );
  }

  // Only one Rotation is active, so turning this one on turns any other off.
  const setActive = async (active: boolean) => {
    await runOrAlert("Couldn't change the active rotation", () =>
      tracker.setActiveRotation(active ? id : null),
    );
  };

  const confirmDelete = () => {
    Alert.alert(`Delete ${rotation.name}?`, 'Its templates stay, and past workouts are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await runOrAlert("Couldn't delete the rotation", () => tracker.deleteRotation(id))) {
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: rotation.name }} />
      <NameField
        name={rotation.name}
        accessibilityLabel="Rotation name"
        failureTitle="Couldn't rename the rotation"
        rename={name => tracker.renameRotation(id, name)}
      />
      <Card style={styles.active}>
        <View style={styles.text}>
          <AppText variant="bodyStrong">Active</AppText>
          <AppText variant="caption" tone="muted">
            Today shows its next-up template
          </AppText>
        </View>
        <Toggle
          accessibilityLabel="Active rotation"
          value={rotation.isActive}
          onValueChange={setActive}
        />
      </Card>
      <Section title="Templates, in order">
        {rotation.entries.length === 0 ? (
          <Card>
            <EmptyState
              icon="list"
              title="No templates yet"
              message="Add them in the order you do them."
            />
          </Card>
        ) : (
          rotation.entries.map((entry, index) => (
            <RotationEntryRow key={entry.id} rotation={rotation} entry={entry} index={index} />
          ))
        )}
        <Button
          variant={rotation.entries.length === 0 ? 'primary' : 'secondary'}
          size="large"
          icon="add"
          label="Add template"
          onPress={() =>
            router.push({ pathname: '/rotations/choose-template', params: { rotationId: id } })
          }
        />
      </Section>
      <Button variant="ghost" destructive label="Delete rotation" onPress={confirmDelete} />
    </Screen>
  );
}

type RowProps = {
  rotation: Rotation;
  entry: RotationEntry;
  index: number;
};

// A Template at its place in the Rotation.
function RotationEntryRow({ rotation, entry, index }: RowProps) {
  const { colors } = useAppTheme();
  const { name } = entry.template;
  const isLast = index === rotation.entries.length - 1;

  const moveTo = (toIndex: number) =>
    runOrAlert("Couldn't move the template", () =>
      tracker.moveTemplateInRotation(entry.id, toIndex),
    );

  const confirmRemove = () => {
    Alert.alert(`Remove ${name} from ${rotation.name}?`, 'The template itself stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          runOrAlert("Couldn't remove the template", () =>
            tracker.removeTemplateFromRotation(entry.id),
          ),
      },
    ]);
  };

  return (
    <Card style={styles.entry}>
      <View style={[styles.number, { backgroundColor: colors.primarySoft }]}>
        <AppText variant="label" style={{ color: colors.onPrimarySoft }}>
          {index + 1}
        </AppText>
      </View>
      <AppText variant="bodyStrong" style={styles.text}>
        {name}
      </AppText>
      <IconButton
        icon="arrow-up"
        label={`Move ${name} up`}
        tone="muted"
        size={22}
        disabled={index === 0}
        onPress={() => moveTo(index - 1)}
      />
      <IconButton
        icon="arrow-down"
        label={`Move ${name} down`}
        tone="muted"
        size={22}
        disabled={isLast}
        onPress={() => moveTo(index + 1)}
      />
      <IconButton
        icon="trash-outline"
        label={`Remove ${name}`}
        tone="danger"
        size={22}
        onPress={confirmRemove}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  text: {
    flex: 1,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    paddingRight: space.xs,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
