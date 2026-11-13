import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { IconButton } from '@/components/icon-button';
import { Input } from '@/components/input';
import {
  initialFieldsOf,
  SetFields,
  setLabels,
  setPresentationFor,
  useSetFields,
} from '@/components/set-fields';
import { Toggle } from '@/components/toggle';
import {
  canSwapExercise,
  describeSet,
  type ExerciseEntry,
  type PlannedSet,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDate } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { minTouch, radius, space, useAppTheme } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

type Props = {
  entry: ExerciseEntry;
  displayUnit: WeightUnit;
};

// One Exercise in a Workout: its notes, its Sets, each open to correction, the
// Sets still planned, and a row to log another one.
export function ExerciseEntryCard({ entry, displayUnit }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { trackingType } = entry.exercise;
  const [editingSetId, setEditingSetId] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  // While Sets are still planned, the row for another one waits behind a
  // button, so a long Workout is less to scroll through.
  const [addingAnother, setAddingAnother] = useState(false);
  // After logging, the weight and the warm-up mark stay; reps clear, so a stray
  // tap can't log a duplicate Set. "Same as last set" is for repeating one.
  const next = useSetFields(trackingType, displayUnit);
  const labels = setLabels(entry.sets, entry.plannedSets.length);
  const { hint } = setPresentationFor[trackingType];
  const hasPlanned = entry.plannedSets.length > 0;

  async function logSet() {
    const { values } = next;
    if (!values) return;
    if (await runOrAlert("Couldn't log the Set", () => tracker.logSet(entry.id, values))) {
      next.clearReps();
    }
  }

  function confirmRemove() {
    const removeNow = () =>
      runOrAlert("Couldn't remove the exercise", () => tracker.removeExerciseFromWorkout(entry.id));
    if (entry.sets.length === 0) {
      removeNow();
      return;
    }
    // Its Sets go with it, so check first.
    const setCount = entry.sets.length === 1 ? '1 set' : `${entry.sets.length} sets`;
    Alert.alert(`Remove ${entry.exercise.name} and its ${setCount}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: removeNow },
    ]);
  }

  const actions: SheetAction[] = [
    ...(canSwapExercise(entry)
      ? [
          {
            label: 'Swap exercise',
            icon: 'swap-horizontal' as const,
            onPress: () =>
              router.push({
                pathname: '/workout/choose-exercise',
                params: { swapEntryId: entry.id },
              }),
          },
        ]
      : []),
    { label: 'Remove exercise', icon: 'trash-outline', destructive: true, onPress: confirmRemove },
  ];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="heading" style={styles.name}>
          {entry.exercise.name}
        </AppText>
        <IconButton
          icon="ellipsis-horizontal"
          label={`More for ${entry.exercise.name}`}
          onPress={() => setMenuOpen(true)}
          style={styles.more}
        />
      </View>
      <LastTimeLine entry={entry} />
      <ReadyToGoHeavierLine entry={entry} />
      <EntryNotes entry={entry} />
      {(entry.sets.length > 0 || hasPlanned) && (
        <View style={styles.sets}>
          {entry.sets.map((set, index) =>
            set.id === editingSetId ? (
              <SetEditor
                key={set.id}
                set={set}
                trackingType={trackingType}
                onDone={() => setEditingSetId(undefined)}
              />
            ) : (
              <SetRow
                key={set.id}
                set={set}
                label={labels[index]}
                trackingType={trackingType}
                onPress={() => setEditingSetId(set.id)}
              />
            ),
          )}
          {entry.plannedSets.map((planned, index) => (
            <PlannedSetRow
              key={planned.id}
              planned={planned}
              label={labels[entry.sets.length + index]}
              trackingType={trackingType}
              // The next one to do stands out.
              isNext={index === 0}
            />
          ))}
        </View>
      )}
      {hasPlanned && !addingAnother ? (
        <Button
          variant="ghost"
          size="small"
          icon="add"
          label="Add a set or warm-up"
          onPress={() => setAddingAnother(true)}
          style={styles.reveal}
        />
      ) : (
        <View style={[styles.another, { borderTopColor: colors.border }]}>
          <AppText variant="overline" tone="muted">
            {hasPlanned ? 'Add another set' : 'Add a set'}
          </AppText>
          <View style={styles.inputs}>
            <SetBadge kind="new" label={next.isWarmUp ? 'W' : '+'} />
            <SetFields {...next.fields} />
            <Button
              variant={hasPlanned ? 'tonal' : 'primary'}
              label="Log"
              accessibilityLabel={next.isWarmUp ? 'Log warm-up' : 'Log set'}
              disabled={!next.values}
              onPress={logSet}
              style={styles.log}
            />
          </View>
          <View style={styles.options}>
            <Chip
              label="Warm-up"
              selected={next.isWarmUp}
              onPress={() => next.setIsWarmUp(!next.isWarmUp)}
            />
            {entry.sets.length > 0 && (
              <Button
                variant="ghost"
                size="small"
                icon="copy-outline"
                label="Same as last set"
                onPress={async () => {
                  await runOrAlert("Couldn't copy the last Set", () =>
                    tracker.logSameAsLastSet(entry.id),
                  );
                }}
              />
            )}
          </View>
          {hint && (
            <AppText variant="caption" tone="muted">
              {hint}
            </AppText>
          )}
        </View>
      )}
      <ActionSheet
        visible={menuOpen}
        title={entry.exercise.name}
        actions={actions}
        onClose={() => setMenuOpen(false)}
      />
    </Card>
  );
}

type SetBadgeProps = {
  // done: a logged Set. planned: one still to do. new: the row for another.
  kind: 'done' | 'planned' | 'new';
  // Its number among the working Sets, or W for a warm-up.
  label: string;
};

// The mark at the start of each Set's row, lining the rows up.
function SetBadge({ kind, label }: SetBadgeProps) {
  const { colors } = useAppTheme();
  const done = kind === 'done';

  return (
    <View
      importantForAccessibility={kind === 'new' ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={kind === 'new'}
      style={[
        styles.badge,
        done
          ? { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }
          : { borderColor: colors.border },
      ]}
    >
      <AppText variant="label" style={{ color: done ? colors.onPrimarySoft : colors.textMuted }}>
        {label}
      </AppText>
    </View>
  );
}

type SetRowProps = {
  set: WorkoutSet;
  label: string;
  trackingType: TrackingType;
  onPress: () => void;
};

function SetRow({ set, label, trackingType, onPress }: SetRowProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this set for correcting"
      onPress={onPress}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [styles.setRow, pressed && styles.pressed]}
    >
      <SetBadge kind="done" label={label} />
      <AppText variant="bodyStrong" style={styles.setText}>
        {describeSet(trackingType, set)}
      </AppText>
      <Ionicons name="create-outline" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

type PlannedSetRowProps = {
  planned: PlannedSet;
  label: string;
  trackingType: TrackingType;
  isNext: boolean;
};

// A Set planned from the Template's Target, pre-filled in the Target's unit.
// Logging it confirms it, with any numbers changed on the day.
function PlannedSetRow({ planned, label, trackingType, isNext }: PlannedSetRowProps) {
  const fields = useSetFields(trackingType, planned.weightUnit, initialFieldsOf(planned));

  async function confirm() {
    const { values } = fields;
    if (!values) return;
    await runOrAlert("Couldn't log the Set", () => tracker.confirmPlannedSet(planned.id, values));
  }

  return (
    <View style={styles.inputs}>
      <SetBadge kind="planned" label={label} />
      <SetFields {...fields.fields} />
      <Button
        variant={isNext ? 'primary' : 'tonal'}
        label="Log"
        accessibilityLabel={`Log set ${label}`}
        disabled={!fields.values}
        onPress={confirm}
        style={styles.log}
      />
    </View>
  );
}

type SetEditorProps = {
  set: WorkoutSet;
  trackingType: TrackingType;
  onDone: () => void;
};

// Corrects a logged Set in its own unit, including whether it's a warm-up; or
// deletes it. Nothing changes until Save.
function SetEditor({ set, trackingType, onDone }: SetEditorProps) {
  const { colors } = useAppTheme();
  const edit = useSetFields(trackingType, set.weightUnit, initialFieldsOf(set));

  async function save() {
    const { values } = edit;
    if (!values) return;
    if (await runOrAlert("Couldn't correct the Set", () => tracker.editSet(set.id, values))) {
      onDone();
    }
  }

  async function remove() {
    if (await runOrAlert("Couldn't delete the Set", () => tracker.deleteSet(set.id))) onDone();
  }

  return (
    <View style={[styles.editor, { borderColor: colors.primary }]}>
      <View style={styles.inputs}>
        <SetFields {...edit.fields} />
      </View>
      <View style={styles.warmUp}>
        <AppText style={styles.setText}>Warm-up</AppText>
        <Toggle
          accessibilityLabel="Warm-up"
          value={edit.isWarmUp}
          onValueChange={edit.setIsWarmUp}
        />
      </View>
      <View style={styles.editorActions}>
        <Button label="Save" disabled={!edit.values} onPress={save} style={styles.editorAction} />
        <Button variant="secondary" label="Cancel" onPress={onDone} style={styles.editorAction} />
        <IconButton icon="trash-outline" label="Delete" tone="danger" filled onPress={remove} />
      </View>
    </View>
  );
}

// The Exercise's working Sets from the finished Workout before this one, to
// beat. Nothing when it wasn't done before.
function LastTimeLine({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useAppTheme();
  const { id, exercise } = entry;
  const lastTime = useTrackerQuery(() => tracker.getLastTime(id), [id]);
  if (!lastTime) return null;

  const describe = (set: WorkoutSet) => describeSet(exercise.trackingType, set);
  return (
    <View style={styles.lastTime}>
      <Ionicons
        name="time-outline"
        size={16}
        color={colors.textMuted}
        style={styles.lastTimeIcon}
      />
      <AppText variant="caption" tone="muted" style={styles.setText}>
        Last time, {formatLocalDate(lastTime.localDate)}: {lastTime.sets.map(describe).join(', ')}
      </AppText>
    </View>
  );
}

// Shown when the Exercise hit the top of its Target's rep range on every Set
// last session under this Workout's Template.
function ReadyToGoHeavierLine({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useAppTheme();
  const { id } = entry;
  const ready = useTrackerQuery(() => tracker.isReadyToGoHeavier(id), [id]);
  if (!ready) return null;

  return (
    <View style={[styles.ready, { backgroundColor: colors.primarySoft }]}>
      <Ionicons name="trending-up" size={16} color={colors.onPrimarySoft} />
      <AppText variant="label" style={{ color: colors.onPrimarySoft }}>
        Ready to go heavier
      </AppText>
    </View>
  );
}

// Saved shortly after the lifter stops typing, and when the card goes away, so
// a note isn't lost if they finish the Workout straight after writing it.
function EntryNotes({ entry }: { entry: ExerciseEntry }) {
  const [notes, setNotes] = useState(entry.notes);
  const latest = useRef(entry.notes);
  const saved = useRef(entry.notes);

  const save = useCallback(() => {
    if (latest.current === saved.current) return;
    saved.current = latest.current;
    tracker
      .saveEntryNotes(entry.id, latest.current)
      // Only fails once the Exercise has been removed or the Workout discarded.
      .catch(error => console.warn('Could not save notes', error));
  }, [entry.id]);

  useEffect(() => {
    const timer = setTimeout(save, 600);
    return () => clearTimeout(timer);
  }, [notes, save]);
  useEffect(() => save, [save]);

  return (
    <Input
      value={notes}
      onChangeText={text => {
        latest.current = text;
        setNotes(text);
      }}
      onEndEditing={save}
      placeholder="Notes"
      multiline
      dense
      accessibilityLabel={`Notes for ${entry.exercise.name}`}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    flex: 1,
  },
  // Its icon lines up with the card's edge; the touch area runs past it.
  more: {
    marginRight: -space.md,
    marginVertical: -space.sm,
  },
  lastTime: {
    flexDirection: 'row',
    gap: space.xs,
  },
  lastTimeIcon: {
    marginTop: 1,
  },
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  sets: {
    gap: space.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: minTouch,
  },
  setText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  log: {
    width: 68,
    paddingHorizontal: 0,
  },
  reveal: {
    alignSelf: 'flex-start',
    marginLeft: -space.md,
  },
  another: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  options: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  editor: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  warmUp: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouch,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  editorAction: {
    flex: 1,
  },
});
