import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { canAddToRotation, type Template } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { exerciseCount } from '@/template-labels';
import { useGuardedPress } from '@/use-guarded-press';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks a Template to add to the end of a Rotation, from those it can take.
export default function ChooseRotationTemplateScreen() {
  const { rotationId } = useLocalSearchParams<{ rotationId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const templates = useTrackerQuery(async () => {
    const [all, rotation] = await Promise.all([
      tracker.getTemplates(),
      tracker.getRotation(rotationId),
    ]);
    return {
      hasTemplates: all.length > 0,
      addable: rotation ? all.filter(({ id }) => canAddToRotation(rotation, id)) : [],
    };
  }, [rotationId]);

  async function add(template: Template) {
    const added = await runOrAlert("Couldn't add the template", () =>
      tracker.addTemplateToRotation(rotationId, template.id),
    );
    if (added) router.back();
  }

  return (
    <FlatList
      data={templates?.addable ?? []}
      keyExtractor={template => template.id}
      renderItem={({ item }) => <TemplateRow template={item} onPress={() => add(item)} />}
      ListEmptyComponent={
        templates &&
        (templates.hasTemplates ? (
          <Text style={[styles.empty, { color: colors.text }]}>
            Every template is already in this rotation.
          </Text>
        ) : (
          <Text style={[styles.empty, { color: colors.text }]}>
            No templates yet.{' '}
            <Link href="/templates" style={{ color: colors.primary }}>
              Create one
            </Link>
          </Text>
        ))
      }
    />
  );
}

type TemplateRowProps = {
  template: Template;
  onPress: () => Promise<void>;
};

function TemplateRow({ template, onPress }: TemplateRowProps) {
  const { colors } = useTheme();
  // A double tap adds it once, not an error about the first.
  const { press, busy } = useGuardedPress(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${template.name}`}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={press}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]}>{template.name}</Text>
        <Text style={[styles.details, { color: colors.text }]}>
          {exerciseCount(template.exercises.length)}
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  details: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
