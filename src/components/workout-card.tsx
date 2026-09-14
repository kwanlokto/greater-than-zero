import { useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { setLabels, setPresentationFor } from '@/components/set-fields';
import type { ExerciseEntry, Workout } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';

// A finished Workout as it was recorded: when it took place, then each
// Exercise with its notes and Sets, weights in the display unit.
export function WorkoutCard({ workout }: { workout: Workout }) {
  const { colors } = useTheme();
  const { startedAt, finishedAt } = workout;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.time, { color: colors.text }]}>
        {finishedAt
          ? `${formatTimeOfDay(startedAt)} – ${formatTimeOfDay(finishedAt)}`
          : formatTimeOfDay(startedAt)}
      </Text>
      {workout.entries.map(entry => (
        <RecordedExerciseEntry key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

function RecordedExerciseEntry({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useTheme();
  const { describe } = setPresentationFor[entry.exercise.trackingType];
  const labels = setLabels(entry.sets);

  return (
    <View style={styles.entry}>
      <Text style={[styles.exerciseName, { color: colors.text }]}>{entry.exercise.name}</Text>
      {entry.notes !== '' && (
        <Text style={[styles.notes, { color: colors.text }]}>{entry.notes}</Text>
      )}
      {entry.sets.length === 0 && (
        <Text style={[styles.notes, { color: colors.text }]}>No sets</Text>
      )}
      {entry.sets.map((set, index) => (
        <View key={set.id} style={styles.setRow}>
          <Text style={[styles.setLabel, { color: colors.text }]}>{labels[index]}</Text>
          <Text style={[styles.setText, { color: colors.text }]}>{describe(set)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  time: {
    fontSize: 14,
    opacity: 0.7,
  },
  entry: {
    gap: 4,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '600',
  },
  notes: {
    fontSize: 14,
    opacity: 0.7,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
});
