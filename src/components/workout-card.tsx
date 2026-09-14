import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { setLabels, setPresentationFor } from '@/components/set-fields';
import { isBackfilled, type ExerciseEntry, type Workout } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';

// When a Workout took place, e.g. "6:00 PM – 7:05 PM". A backfilled one's
// times are only when it was entered, so they aren't shown.
export function workoutTimes(workout: Workout): string {
  const { startedAt, finishedAt } = workout;
  if (isBackfilled(workout)) return 'Added later';
  return finishedAt
    ? `${formatTimeOfDay(startedAt)} – ${formatTimeOfDay(finishedAt)}`
    : formatTimeOfDay(startedAt);
}

type Props = {
  workout: Workout;
  onPress: () => void;
};

// A finished Workout as it was recorded: when it took place, then each
// Exercise with its notes and Sets, weights in the display unit. Pressing it
// opens it for editing.
export function WorkoutCard({ workout, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this workout for editing"
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <Text style={[styles.time, { color: colors.text }]}>{workoutTimes(workout)}</Text>
        <Ionicons name="create-outline" size={18} color={colors.text} style={styles.faint} />
      </View>
      {workout.entries.map(entry => (
        <RecordedExerciseEntry key={entry.id} entry={entry} />
      ))}
    </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    flex: 1,
    fontSize: 14,
    opacity: 0.7,
  },
  faint: {
    opacity: 0.5,
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
