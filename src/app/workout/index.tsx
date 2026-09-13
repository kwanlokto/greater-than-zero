import { Stack, useRouter, useTheme } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import {
  problemWithSet,
  type ExerciseEntry,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@/core/tracker';
import { tracker } from '@/database';
import { useTrackerQuery } from '@/use-tracker-query';

export default function WorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const workout = useTrackerQuery(() => tracker.getWorkoutInProgress(), []);
  const displayUnit = useTrackerQuery(() => tracker.getDisplayUnit(), []);

  if (workout === undefined || displayUnit === undefined) return null;
  if (workout === null) {
    return <Text style={[styles.message, { color: colors.text }]}>No workout in progress.</Text>;
  }

  const confirmFinish = () => {
    Alert.alert('Finish workout?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          await tracker.finishWorkout(workout.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" hitSlop={12} onPress={confirmFinish}>
              <Text style={[styles.finish, { color: colors.primary }]}>Finish</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {workout.entries.length === 0 && (
          <Text style={[styles.message, { color: colors.text }]}>
            Add an exercise to start logging sets.
          </Text>
        )}
        {workout.entries.map(entry => (
          <EntryCard key={entry.id} entry={entry} displayUnit={displayUnit} />
        ))}
        <PrimaryButton
          label="Add exercise"
          onPress={() =>
            router.push({ pathname: '/workout/add-exercise', params: { workoutId: workout.id } })
          }
        />
      </ScrollView>
    </>
  );
}

// How the weight field reads for each tracking type.
const weightFieldFor: Record<
  TrackingType,
  (unit: WeightUnit) => {
    keyboardType: KeyboardTypeOptions;
    placeholder: string;
    unitLabel: string;
    accessibilityLabel: string;
    hint?: string;
  }
> = {
  weighted: unit => ({
    keyboardType: 'decimal-pad',
    placeholder: '0',
    unitLabel: unit,
    accessibilityLabel: `Weight in ${unit}`,
  }),
  bodyweight: unit => ({
    // The numeric keyboard has a minus key, for assisted Sets.
    keyboardType: 'numeric',
    placeholder: 'none',
    unitLabel: `${unit} added`,
    accessibilityLabel: `Added weight in ${unit}: blank for bodyweight, negative if assisted`,
    hint: 'Leave blank for bodyweight. Use a negative number for an assisted machine.',
  }),
};

// One Exercise in the Workout: its Sets so far, and a row to log the next one.
function EntryCard({ entry, displayUnit }: { entry: ExerciseEntry; displayUnit: WeightUnit }) {
  const { colors } = useTheme();
  const { trackingType } = entry.exercise;
  const weightField = weightFieldFor[trackingType](displayUnit);
  // The weight stays after logging; reps clear, so a stray tap can't log a
  // duplicate Set.
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const parsedWeight = parseWeight(weight);
  const parsedReps = parseWholeNumber(reps);
  const set =
    parsedWeight !== undefined && parsedReps !== undefined
      ? { weight: parsedWeight, reps: parsedReps }
      : undefined;
  // The core's own rule decides, so the screen can't drift from it.
  const canLog = set !== undefined && problemWithSet(trackingType, set) === undefined;

  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
  ];

  async function logSet() {
    if (!set || !canLog) return;
    try {
      await tracker.logSet(entry.id, set);
      setReps('');
    } catch (error) {
      Alert.alert("Couldn't log the Set", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.exerciseName, { color: colors.text }]}>{entry.exercise.name}</Text>
      {entry.sets.map((loggedSet, index) => (
        <Text key={loggedSet.id} style={[styles.set, { color: colors.text }]}>
          Set {index + 1}: {describeSet(loggedSet, trackingType)}
        </Text>
      ))}
      <View style={styles.logRow}>
        <View style={styles.field}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType={weightField.keyboardType}
            placeholder={weightField.placeholder}
            placeholderTextColor="#8e8e93"
            accessibilityLabel={weightField.accessibilityLabel}
            style={inputStyle}
          />
          <Text style={[styles.unit, { color: colors.text }]}>{weightField.unitLabel}</Text>
        </View>
        <View style={styles.field}>
          <TextInput
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#8e8e93"
            accessibilityLabel="Reps"
            style={inputStyle}
          />
          <Text style={[styles.unit, { color: colors.text }]}>reps</Text>
        </View>
        <PrimaryButton label="Log" disabled={!canLog} onPress={logSet} />
      </View>
      {weightField.hint && (
        <Text style={[styles.hint, { color: colors.text }]}>{weightField.hint}</Text>
      )}
    </View>
  );
}

function describeSet(set: WorkoutSet, trackingType: TrackingType): string {
  if (trackingType === 'weighted') return `${set.weight} ${set.weightUnit} × ${set.reps}`;
  // No added weight, whether left blank or entered as 0, is plain bodyweight.
  if (!set.weight) return `Bodyweight × ${set.reps}`;
  const sign = set.weight < 0 ? '−' : '+';
  return `Bodyweight ${sign} ${Math.abs(set.weight)} ${set.weightUnit} × ${set.reps}`;
}

// Null when blank, undefined when it isn't a number. Accepts a comma as the
// decimal separator too, as some keyboards type one.
function parseWeight(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

function parseWholeNumber(text: string): number | undefined {
  return /^\d+$/.test(text.trim()) ? Number(text) : undefined;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  finish: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
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
  set: {
    fontSize: 16,
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: 72,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'right',
  },
  unit: {
    fontSize: 14,
    opacity: 0.7,
  },
  hint: {
    fontSize: 13,
    opacity: 0.7,
  },
});
