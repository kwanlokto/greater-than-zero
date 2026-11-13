import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { setLabels } from '@/components/set-fields';
import { describeSet, type ExerciseEntry, type Workout } from '@/core/tracker';
import { radius, space, useAppTheme } from '@/theme';
import { workoutTimes } from '@/workout-labels';

type Props = {
  workout: Workout;
  onPress: () => void;
};

// A finished Workout as it was recorded: when it took place, then each
// Exercise with its notes and Sets, weights in the display unit. Pressing it
// opens it for editing.
export function WorkoutCard({ workout, onPress }: Props) {
  const { colors } = useAppTheme();

  return (
    <Card onPress={onPress} accessibilityHint="Opens this workout for editing" style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        <AppText variant="label" tone="muted" style={styles.time}>
          {workoutTimes(workout)}
        </AppText>
        <Ionicons name="create-outline" size={20} color={colors.textFaint} />
      </View>
      {workout.entries.map(entry => (
        <RecordedExerciseEntry key={entry.id} entry={entry} />
      ))}
    </Card>
  );
}

// An Exercise's Sets as a wrapping row of pills, each with its label: W for a
// warm-up, then 1, 2… for working Sets.
function RecordedExerciseEntry({ entry }: { entry: ExerciseEntry }) {
  const { colors } = useAppTheme();
  const labels = setLabels(entry.sets);

  return (
    <View style={styles.entry}>
      <AppText variant="subheading">{entry.exercise.name}</AppText>
      {entry.notes !== '' && (
        <AppText variant="caption" tone="muted">
          {entry.notes}
        </AppText>
      )}
      {entry.sets.length === 0 ? (
        <AppText variant="caption" tone="muted">
          No sets
        </AppText>
      ) : (
        <View style={styles.sets}>
          {entry.sets.map((set, index) => (
            <View key={set.id} style={[styles.set, { backgroundColor: colors.field }]}>
              <AppText variant="label" tone="muted">
                {labels[index]}
              </AppText>
              <AppText variant="caption">{describeSet(entry.exercise.trackingType, set)}</AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  time: {
    flex: 1,
  },
  entry: {
    gap: space.xs,
  },
  sets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: 2,
  },
  set: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
});
