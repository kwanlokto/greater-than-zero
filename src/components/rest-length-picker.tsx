import { useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';
import { formatDuration } from '@/durations';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

const restChoices = [30, 45, 60, 90, 120, 150, 180, 240, 300];

// The rest after a Set of this Exercise. Saved as soon as it's chosen.
export function RestLengthPicker({ exercise }: { exercise: Exercise }) {
  const { colors } = useTheme();
  const defaultSeconds = useTrackerQuery(() => tracker.getDefaultRestSeconds(), []);

  function choose(seconds: number | null) {
    runOrAlert("Couldn't change the rest", () => tracker.setExerciseRest(exercise.id, seconds));
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Rest between sets</Text>
      <View style={styles.chips}>
        <Chip
          label={defaultSeconds === undefined ? 'Default' : `Default (${formatDuration(defaultSeconds)})`}
          selected={exercise.defaultRestSeconds === null}
          onPress={() => choose(null)}
        />
        {restChoices.map(seconds => (
          <Chip
            key={seconds}
            label={formatDuration(seconds)}
            selected={exercise.defaultRestSeconds === seconds}
            onPress={() => choose(seconds)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
