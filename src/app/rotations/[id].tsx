import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { NameField } from '@/components/name-field';
import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import type { Rotation, RotationEntry } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Rotation: its name, whether it's the active one, and its Templates in
// the order they come up. Every change is saved as it's made.
export default function RotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's no such Rotation, e.g. after it's deleted.
  const rotation = useTrackerQuery(async () => (await tracker.getRotation(id)) ?? null, [id]);

  if (rotation === undefined) return null;
  if (rotation === null) {
    return <Text style={[styles.message, { color: colors.text }]}>This rotation was deleted.</Text>;
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: rotation.name }} />
      <NameField
        name={rotation.name}
        accessibilityLabel="Rotation name"
        failureTitle="Couldn't rename the rotation"
        rename={name => tracker.renameRotation(id, name)}
      />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardText}>
          <Text style={[styles.title, { color: colors.text }]}>Active</Text>
          <Text style={[styles.details, { color: colors.text }]}>
            Today shows its next-up template
          </Text>
        </View>
        <Switch
          accessibilityLabel="Active rotation"
          value={rotation.isActive}
          onValueChange={setActive}
        />
      </View>
      {rotation.entries.length === 0 ? (
        <Text style={[styles.message, { color: colors.text }]}>No templates yet.</Text>
      ) : (
        rotation.entries.map((entry, index) => (
          <RotationEntryRow key={entry.id} rotation={rotation} entry={entry} index={index} />
        ))
      )}
      <PrimaryButton
        label="Add template"
        onPress={() =>
          router.push({ pathname: '/rotations/choose-template', params: { rotationId: id } })
        }
      />
      <TextButton label="Delete rotation" destructive onPress={confirmDelete} />
    </ScrollView>
  );
}

type RowProps = {
  rotation: Rotation;
  entry: RotationEntry;
  index: number;
};

// A Template at its place in the Rotation.
function RotationEntryRow({ rotation, entry, index }: RowProps) {
  const { colors } = useTheme();
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
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardText, styles.title, { color: colors.text }]}>
        {index + 1}. {name}
      </Text>
      <IconButton
        icon="arrow-up"
        label={`Move ${name} up`}
        disabled={index === 0}
        onPress={() => moveTo(index - 1)}
      />
      <IconButton
        icon="arrow-down"
        label={`Move ${name} down`}
        disabled={isLast}
        onPress={() => moveTo(index + 1)}
      />
      <IconButton icon="trash-outline" label={`Remove ${name}`} onPress={confirmRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    gap: 4,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  details: {
    fontSize: 14,
    opacity: 0.7,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
