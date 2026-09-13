import { Stack, useRouter, useTheme } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import type { ExerciseEntry, WeightUnit, WorkoutSet } from '@/core/tracker';
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

// One Exercise in the Workout: its Sets so far, and a row to log the next one.
function EntryCard({ entry, displayUnit }: { entry: ExerciseEntry; displayUnit: WeightUnit }) {
  const { colors } = useTheme();
  // Kept after logging, so repeating a Set is one tap.
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const parsedWeight = parseDecimal(weight);
  const parsedReps = parseWholeNumber(reps);

  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.exerciseName, { color: colors.text }]}>{entry.exercise.name}</Text>
      {entry.sets.map((set, index) => (
        <Text key={set.id} style={[styles.set, { color: colors.text }]}>
          Set {index + 1}: {describeSet(set)}
        </Text>
      ))}
      <View style={styles.logRow}>
        <View style={styles.field}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#8e8e93"
            accessibilityLabel={`Weight in ${displayUnit}`}
            style={inputStyle}
          />
          <Text style={[styles.unit, { color: colors.text }]}>{displayUnit}</Text>
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
        <PrimaryButton
          label="Log"
          disabled={parsedWeight === undefined || parsedReps === undefined}
          onPress={async () => {
            if (parsedWeight === undefined || parsedReps === undefined) return;
            await tracker.logSet(entry.id, { weight: parsedWeight, reps: parsedReps });
          }}
        />
      </View>
    </View>
  );
}

function describeSet(set: WorkoutSet): string {
  return set.weight === null
    ? `${set.reps} reps`
    : `${set.weight} ${set.weightUnit} × ${set.reps}`;
}

// Accepts a comma as the decimal separator too, as some keyboards type one.
function parseDecimal(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
}

function parseWholeNumber(text: string): number | undefined {
  return /^\d+$/.test(text.trim()) && Number(text) >= 1 ? Number(text) : undefined;
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
});
