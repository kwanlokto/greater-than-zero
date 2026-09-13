import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { fieldTextOf, SetFields, typedSet, weightHintFor } from '@/components/set-fields';
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
  // The weight stays after logging; reps clear, so a stray tap can't log a
  // duplicate Set. "Same as last set" is for repeating one.
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const newSet = typedSet(trackingType, weight, reps);
  const labels = setLabels(entry.sets);
  const hint = weightHintFor[trackingType];

  async function logSet() {
    if (!newSet) return;
    if (await succeeds("Couldn't log the Set", () => tracker.logSet(entry.id, newSet))) setReps('');
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
        <SetFields
          trackingType={trackingType}
          unit={displayUnit}
          weight={weight}
          reps={reps}
          onChangeWeight={setWeight}
          onChangeReps={setReps}
        />
        <PrimaryButton label="Log" disabled={!newSet} onPress={logSet} />
      </View>
      {entry.sets.length > 0 && (
        <TextButton
          label="Same as last set"
          onPress={async () => {
            await succeeds("Couldn't copy the last Set", () => tracker.logSameAsLastSet(entry.id));
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
      <Text style={[styles.setText, { color: colors.text }]}>{describeSet(set, trackingType)}</Text>
      <Ionicons name="create-outline" size={18} color={colors.text} style={styles.faint} />
    </Pressable>
  );
}

type SetEditorProps = {
  set: WorkoutSet;
  trackingType: TrackingType;
  onDone: () => void;
};

// Corrects a logged Set in its own unit, marks it as a warm-up, or deletes it.
function SetEditor({ set, trackingType, onDone }: SetEditorProps) {
  const { colors } = useTheme();
  const [weight, setWeight] = useState(fieldTextOf(set).weight);
  const [reps, setReps] = useState(fieldTextOf(set).reps);
  const corrected = typedSet(trackingType, weight, reps);

  async function save() {
    if (!corrected) return;
    if (await succeeds("Couldn't correct the Set", () => tracker.editSet(set.id, corrected))) {
      onDone();
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this set?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await succeeds("Couldn't delete the Set", () => tracker.deleteSet(set.id))) onDone();
        },
      },
    ]);
  }

  return (
    <View style={[styles.editor, { borderColor: colors.border }]}>
      <View style={styles.row}>
        <SetFields
          trackingType={trackingType}
          unit={set.weightUnit}
          weight={weight}
          reps={reps}
          onChangeWeight={setWeight}
          onChangeReps={setReps}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.setText, { color: colors.text }]}>Warm-up</Text>
        <Switch
          value={set.isWarmUp}
          onValueChange={async isWarmUp => {
            await succeeds("Couldn't change the warm-up", () => tracker.setWarmUp(set.id, isWarmUp));
          }}
        />
      </View>
      <View style={styles.row}>
        <PrimaryButton label="Save" disabled={!corrected} onPress={save} />
        <TextButton label="Cancel" onPress={onDone} />
        <TextButton label="Delete" destructive onPress={confirmDelete} />
      </View>
    </View>
  );
}

// Warm-ups are marked W; working Sets are numbered among themselves.
function setLabels(sets: WorkoutSet[]): string[] {
  let working = 0;
  return sets.map(set => (set.isWarmUp ? 'W' : String(++working)));
}

function describeSet(set: WorkoutSet, trackingType: TrackingType): string {
  if (trackingType === 'weighted') return `${set.weight} ${set.weightUnit} × ${set.reps}`;
  // No added weight, whether left blank or entered as 0, is plain bodyweight.
  if (!set.weight) return `Bodyweight × ${set.reps}`;
  const sign = set.weight < 0 ? '−' : '+';
  return `Bodyweight ${sign} ${Math.abs(set.weight)} ${set.weightUnit} × ${set.reps}`;
}

// Runs a core command, telling the lifter why if it's refused.
async function succeeds(failureTitle: string, command: () => Promise<void>): Promise<boolean> {
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
