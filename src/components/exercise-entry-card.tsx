import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import { PrimaryButton } from '@/components/primary-button';
import {
  initialFieldsOf,
  SetFields,
  setPresentationFor,
  useSetFields,
} from '@/components/set-fields';
import { TextButton } from '@/components/text-button';
import type { ExerciseEntry, TrackingType, WeightUnit, WorkoutSet } from '@/core/tracker';
import { tracker } from '@/database';

type Props = {
  entry: ExerciseEntry;
  displayUnit: WeightUnit;
};

// One Exercise in a Workout: its Sets, each open to correction, and a row to
// log the next one.
export function ExerciseEntryCard({ entry, displayUnit }: Props) {
  const { colors } = useTheme();
  const { trackingType } = entry.exercise;
  const [editingSetId, setEditingSetId] = useState<string>();
  // After logging, the weight and the warm-up mark stay; reps clear, so a stray
  // tap can't log a duplicate Set. "Same as last set" is for repeating one.
  const next = useSetFields(trackingType, displayUnit);
  const labels = setLabels(entry.sets);
  const { hint } = setPresentationFor[trackingType];

  async function logSet() {
    const { values } = next;
    if (!values) return;
    if (await runOrAlert("Couldn't log the Set", () => tracker.logSet(entry.id, values))) {
      next.clearReps();
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.exerciseName, { color: colors.text }]}>{entry.exercise.name}</Text>
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

// Warm-ups are marked W; working Sets are numbered among themselves.
function setLabels(sets: WorkoutSet[]): string[] {
  let working = 0;
  return sets.map(set => (set.isWarmUp ? 'W' : String(++working)));
}

// Runs a core command, telling the lifter why if it's refused. True if it ran.
async function runOrAlert(failureTitle: string, command: () => Promise<void>): Promise<boolean> {
  try {
    await command();
    return true;
  } catch (error) {
    Alert.alert(failureTitle, error instanceof Error ? error.message : String(error));
    return false;
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
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
