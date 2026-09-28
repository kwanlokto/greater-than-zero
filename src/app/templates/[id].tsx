import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextButton } from '@/components/text-button';
import type { Template, TemplateExercise } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { describeTarget } from '@/template-labels';
import { useGuardedPress } from '@/use-guarded-press';
import { useTrackerQuery } from '@/use-tracker-query';

// One Template: its name, and its Exercises in order with their Targets. Every
// change is saved as it's made.
export default function TemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's no such Template, e.g. after it's deleted.
  const template = useTrackerQuery(async () => (await tracker.getTemplate(id)) ?? null, [id]);

  if (template === undefined) return null;
  if (template === null) {
    return <Text style={[styles.message, { color: colors.text }]}>This template was deleted.</Text>;
  }

  const confirmDelete = () => {
    Alert.alert(`Delete ${template.name}?`, 'Its exercises and targets will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await runOrAlert("Couldn't delete the template", () => tracker.deleteTemplate(id))) {
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: template.name }} />
      <TemplateName template={template} />
      {template.exercises.length === 0 ? (
        <Text style={[styles.message, { color: colors.text }]}>No exercises yet.</Text>
      ) : (
        template.exercises.map((templateExercise, index) => (
          <TemplateExerciseRow
            key={templateExercise.id}
            template={template}
            templateExercise={templateExercise}
            index={index}
          />
        ))
      )}
      <PrimaryButton
        label="Add exercise"
        onPress={() =>
          router.push({ pathname: '/templates/choose-exercise', params: { templateId: id } })
        }
      />
      <TextButton label="Delete template" destructive onPress={confirmDelete} />
    </ScrollView>
  );
}

// Saved when the lifter is done typing. A blank name is refused and put back.
function TemplateName({ template }: { template: Template }) {
  const { colors } = useTheme();
  const [name, setName] = useState(template.name);

  async function save() {
    if (name === template.name) return;
    const renamed = await runOrAlert("Couldn't rename the template", () =>
      tracker.renameTemplate(template.id, name),
    );
    if (!renamed) setName(template.name);
  }

  return (
    <TextInput
      value={name}
      onChangeText={setName}
      onEndEditing={save}
      autoCapitalize="words"
      accessibilityLabel="Template name"
      style={[
        styles.name,
        { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    />
  );
}

type RowProps = {
  template: Template;
  templateExercise: TemplateExercise;
  index: number;
};

// An Exercise and its Target; tapping it changes the Target.
function TemplateExerciseRow({ template, templateExercise, index }: RowProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { id, exercise, target } = templateExercise;
  const isLast = index === template.exercises.length - 1;

  const moveTo = (toIndex: number) =>
    runOrAlert("Couldn't move the exercise", () => tracker.moveTemplateExercise(id, toIndex));

  const confirmRemove = () => {
    Alert.alert(`Remove ${exercise.name} from ${template.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          runOrAlert("Couldn't remove the exercise", () => tracker.removeExerciseFromTemplate(id)),
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens its target for changing"
        onPress={() =>
          router.push({
            pathname: '/templates/target',
            params: { templateId: template.id, templateExerciseId: id },
          })
        }
        style={styles.cardText}
      >
        <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
        <Text style={[styles.target, { color: colors.text }]}>
          {describeTarget(exercise.trackingType, target)}
        </Text>
      </Pressable>
      <IconButton
        icon="arrow-up"
        label={`Move ${exercise.name} up`}
        disabled={index === 0}
        onPress={() => moveTo(index - 1)}
      />
      <IconButton
        icon="arrow-down"
        label={`Move ${exercise.name} down`}
        disabled={isLast}
        onPress={() => moveTo(index + 1)}
      />
      <IconButton icon="trash-outline" label={`Remove ${exercise.name}`} onPress={confirmRemove} />
    </View>
  );
}

type IconButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  disabled?: boolean;
  onPress: () => void | Promise<unknown>;
};

function IconButton({ icon, label, disabled = false, onPress }: IconButtonProps) {
  const { colors } = useTheme();
  // A double tap moves an Exercise one place, not two.
  const { press, busy } = useGuardedPress(async () => {
    await onPress();
  });
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      hitSlop={6}
      onPress={press}
      style={[styles.iconButton, { opacity: inactive ? 0.3 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  name: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '600',
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
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  target: {
    fontSize: 14,
    opacity: 0.7,
  },
  iconButton: {
    padding: 6,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
