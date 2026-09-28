import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useTheme } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { PrimaryButton } from '@/components/primary-button';
import {
  initialFieldsOf,
  SetFields,
  setLabels,
  setPresentationFor,
  useSetFields,
} from '@/components/set-fields';
import { TextButton } from '@/components/text-button';
import {
  canSwapExercise,
  type ExerciseEntry,
  type PlannedSet,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDate } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

type Props = {
  entry: ExerciseEntry;
  displayUnit: WeightUnit;
};

// One Exercise in a Workout: its notes, its Sets, each open to correction, and
// a row to log the next one.
export function ExerciseEntryCard({ entry, displayUnit }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { trackingType } = entry.exercise;
  const [editingSetId, setEditingSetId] = useState<string>();
  // After logging, the weight and the warm-up mark stay; reps clear, so a stray
  // tap can't log a duplicate Set. "Same as last set" is for repeating one.
  const next = useSetFields(trackingType, displayUnit);
  const labels = setLabels(entry.sets, entry.plannedSets.length);
  const { hint } = setPresentationFor[trackingType];

  async function logSet() {
    const { values } = next;
    if (!values) return;
    if (await runOrAlert("Couldn't log the Set", () => tracker.logSet(entry.id, values))) {
      next.clearReps();
    }
  }

  function confirmRemove() {
    const removeNow = () =>
      runOrAlert("Couldn't remove the exercise", () =>
        tracker.removeExerciseFromWorkout(entry.id),
      );
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

  function showActions() {
    Alert.alert(entry.exercise.name, undefined, [
      ...(canSwapExercise(entry)
        ? [
            {
              text: 'Swap exercise',
              onPress: () =>
                router.push({
                  pathname: '/workout/choose-exercise',
                  params: { swapEntryId: entry.id },
                }),
            },
          ]
        : []),
      { text: 'Remove exercise', style: 'destructive' as const, onPress: confirmRemove },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>{entry.exercise.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More for ${entry.exercise.name}`}
          hitSlop={12}
          onPress={showActions}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>
      <LastTimeLine entry={entry} />
      <ReadyToGoHeavierLine entry={entry} />
      <EntryNotes entry={entry} />
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
        />
      ))}
      <View style={styles.row}>
        <SetFields {...next.fields} />
        <Chip
          label="Warm-up"
          selected={next.isWarmUp}
          onPress={() => next.setIsWarmUp(!next.isWarmUp)}
        />
        <PrimaryButton label="Log" disabled={!next.values} onPress={logSet} />
      </View>
      {entry.sets.length > 0 && (
        <TextButton
          label="Same as last set"
          onPress={async () => {
            await runOrAlert("Couldn't copy the last Set", () => tracker.logSameAsLastSet(entry.id));
          }}
        />
      )}
      {hint && <Text style={[styles.hint, { color: colors.text }]}>{hint}</Text>}
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
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this set for correcting"
      onPress={onPress}
      style={styles.setRow}
    >
      <Text style={[styles.setLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.setText, { color: colors.text }]}>
        {setPresentationFor[trackingType].describe(set)}
      </Text>
      <Ionicons name="create-outline" size={18} color={colors.text} style={styles.faint} />
    </Pressable>
  );
}

type PlannedSetRowProps = {
  planned: PlannedSet;
  label: string;
  trackingType: TrackingType;
};

// A Set planned from the Template's Target, pre-filled in the Target's unit.
// Logging it confirms it, with any numbers changed on the day.
function PlannedSetRow({ planned, label, trackingType }: PlannedSetRowProps) {
  const { colors } = useTheme();
  const fields = useSetFields(trackingType, planned.weightUnit, initialFieldsOf(planned));

  async function confirm() {
    const { values } = fields;
    if (!values) return;
    await runOrAlert("Couldn't log the Set", () => tracker.confirmPlannedSet(planned.id, values));
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.setLabel, styles.faint, { color: colors.text }]}>{label}</Text>
      <SetFields {...fields.fields} />
      <PrimaryButton label="Log" disabled={!fields.values} onPress={confirm} />
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
  const { colors } = useTheme();
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
    <View style={[styles.editor, { borderColor: colors.border }]}>
      <View style={styles.row}>
        <SetFields {...edit.fields} />
      </View>
      <View style={styles.row}>
        <Text style={[styles.setText, { color: colors.text }]}>Warm-up</Text>
        <Switch value={edit.isWarmUp} onValueChange={edit.setIsWarmUp} />
      </View>
      <View style={styles.row}>
        <PrimaryButton label="Save" disabled={!edit.values} onPress={save} />
        <TextButton label="Cancel" onPress={onDone} />
        <TextButton label="Delete" destructive onPress={remove} />
      </View>
    </View>
  );
}

// The Exercise's working Sets from the finished Workout before this one, to
// beat. Nothing when it wasn't done before.
function LastTimeLine({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useTheme();
  const { id, exercise } = entry;
  const lastTime = useTrackerQuery(() => tracker.getLastTime(id), [id]);
  if (!lastTime) return null;

  const { describe } = setPresentationFor[exercise.trackingType];
  return (
    <Text style={[styles.lastTime, { color: colors.text }]}>
      Last time, {formatLocalDate(lastTime.localDate)}: {lastTime.sets.map(describe).join(', ')}
    </Text>
  );
}

// Shown when the Exercise hit the top of its Target's rep range on every Set
// last session under this Workout's Template.
function ReadyToGoHeavierLine({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useTheme();
  const { id } = entry;
  const ready = useTrackerQuery(() => tracker.isReadyToGoHeavier(id), [id]);
  if (!ready) return null;

  return (
    <View style={styles.row}>
      <Ionicons name="trending-up" size={18} color={colors.primary} />
      <Text style={[styles.readyToGoHeavier, { color: colors.primary }]}>Ready to go heavier</Text>
    </View>
  );
}

// Saved shortly after the lifter stops typing, and when the card goes away, so
// a note isn't lost if they finish the Workout straight after writing it.
function EntryNotes({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useTheme();
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
    <TextInput
      value={notes}
      onChangeText={text => {
        latest.current = text;
        setNotes(text);
      }}
      onEndEditing={save}
      placeholder="Notes"
      placeholderTextColor="#8e8e93"
      multiline
      accessibilityLabel={`Notes for ${entry.exercise.name}`}
      style={[styles.notes, { color: colors.text, borderColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  lastTime: {
    fontSize: 14,
    opacity: 0.7,
  },
  readyToGoHeavier: {
    fontSize: 14,
    fontWeight: '600',
  },
  notes: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  setLabel: {
    width: 20,
    fontSize: 16,
    fontWeight: '700',
  },
  setText: {
    flex: 1,
    fontSize: 16,
  },
  faint: {
    opacity: 0.5,
  },
  editor: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  hint: {
    fontSize: 13,
    opacity: 0.7,
  },
});
