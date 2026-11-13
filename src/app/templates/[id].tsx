import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { NameField } from '@/components/name-field';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import type { Template, TemplateExercise } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { describeTarget } from '@/template-labels';
import { space, useAppTheme } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// One Template: its name, and its Exercises in order with their Targets. Every
// change is saved as it's made.
export default function TemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Null once there's no such Template, e.g. after it's deleted.
  const template = useTrackerQuery(async () => (await tracker.getTemplate(id)) ?? null, [id]);

  if (template === undefined) return null;
  if (template === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This template was deleted." />
      </Screen>
    );
  }

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${template.name}?`,
      "Its exercises and targets will be removed, and it will leave any rotation it's in.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (
              await runOrAlert("Couldn't delete the template", () => tracker.deleteTemplate(id))
            ) {
              router.back();
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: template.name }} />
      <NameField
        name={template.name}
        accessibilityLabel="Template name"
        failureTitle="Couldn't rename the template"
        rename={name => tracker.renameTemplate(id, name)}
      />
      <Section title="Exercises">
        {template.exercises.length === 0 ? (
          <Card>
            <EmptyState
              icon="barbell-outline"
              title="No exercises yet"
              message="Add the exercises this workout does, each with its target."
            />
          </Card>
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
        <Button
          variant={template.exercises.length === 0 ? 'primary' : 'secondary'}
          size="large"
          icon="add"
          label="Add exercise"
          onPress={() =>
            router.push({ pathname: '/templates/choose-exercise', params: { templateId: id } })
          }
        />
      </Section>
      <Button variant="ghost" destructive label="Delete template" onPress={confirmDelete} />
    </Screen>
  );
}

type RowProps = {
  template: Template;
  templateExercise: TemplateExercise;
  index: number;
};

// An Exercise and its Target; tapping it changes the Target. Arrows move it.
function TemplateExerciseRow({ template, templateExercise, index }: RowProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
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
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens its target for changing"
        onPress={() =>
          router.push({
            pathname: '/templates/target',
            params: { templateId: template.id, templateExerciseId: id },
          })
        }
        style={({ pressed }) => [styles.cardText, pressed && styles.pressed]}
      >
        <View style={[styles.number, { backgroundColor: colors.primarySoft }]}>
          <AppText variant="label" style={{ color: colors.onPrimarySoft }}>
            {index + 1}
          </AppText>
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong">{exercise.name}</AppText>
          <AppText variant="caption" tone="primary">
            {describeTarget(exercise.trackingType, target)}
          </AppText>
        </View>
      </Pressable>
      <View style={styles.tools}>
        <IconButton
          icon="arrow-up"
          label={`Move ${exercise.name} up`}
          tone="muted"
          size={22}
          disabled={index === 0}
          onPress={() => moveTo(index - 1)}
        />
        <IconButton
          icon="arrow-down"
          label={`Move ${exercise.name} down`}
          tone="muted"
          size={22}
          disabled={isLast}
          onPress={() => moveTo(index + 1)}
        />
        <IconButton
          icon="trash-outline"
          label={`Remove ${exercise.name}`}
          tone="danger"
          size={22}
          onPress={confirmRemove}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingVertical: space.sm,
    paddingRight: space.xs,
  },
  cardText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
  },
  pressed: {
    opacity: 0.6,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  tools: {
    flexDirection: 'row',
  },
});
