import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Section } from '@/components/section';
import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';
import { formatDuration } from '@/durations';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

const restChoices = [30, 45, 60, 90, 120, 150, 180, 240, 300];

// The rest after a Set of this Exercise. Saved as soon as it's chosen.
export function RestLengthPicker({ exercise }: { exercise: Exercise }) {
  const defaultSeconds = useTrackerQuery(() => tracker.getFallbackRestSeconds(), []);

  function choose(seconds: number | null) {
    runOrAlert("Couldn't change the rest length", () =>
      tracker.setExerciseDefaultRest(exercise.id, seconds),
    );
  }

  return (
    <Section title="Rest between sets">
      <Card>
        <View style={styles.chips}>
          <Chip
            label={
              defaultSeconds === undefined
                ? 'Default'
                : `Default (${formatDuration(defaultSeconds)})`
            }
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
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
