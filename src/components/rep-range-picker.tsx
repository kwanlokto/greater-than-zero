import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Input } from '@/components/input';
import { Section } from '@/components/section';
import type { Exercise } from '@/core/tracker';
import { tracker } from '@/database';
import { readRepRange, repRangeBoxesOf } from '@/form-values';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';

// The reps this Exercise is done for. Saved when the lifter is done typing,
// once the two boxes make a range. "Ready to go heavier" goes by its top.
export function RepRangePicker({ exercise }: { exercise: Exercise }) {
  const [boxes, setBoxes] = useState(() => repRangeBoxesOf(exercise));
  const { values, problem } = readRepRange(boxes);

  function save() {
    if (!values) return;
    if (values.minReps === exercise.minReps && values.maxReps === exercise.maxReps) return;
    runOrAlert("Couldn't change the rep range", () =>
      tracker.setExerciseRepRange(exercise.id, values),
    );
  }

  return (
    <Section title="Rep range">
      <Card>
        <View style={styles.range}>
          <Input
            value={boxes.minReps}
            onChangeText={minReps => setBoxes(current => ({ ...current, minReps }))}
            onEndEditing={save}
            keyboardType="number-pad"
            accessibilityLabel="Fewest reps"
            align="center"
            strong
            selectTextOnFocus
            style={styles.box}
          />
          <AppText tone="muted">to</AppText>
          <Input
            value={boxes.maxReps}
            onChangeText={maxReps => setBoxes(current => ({ ...current, maxReps }))}
            onEndEditing={save}
            keyboardType="number-pad"
            accessibilityLabel="Most reps"
            align="center"
            strong
            selectTextOnFocus
            style={styles.box}
          />
          <AppText tone="muted">reps</AppText>
        </View>
        {problem && (
          <AppText variant="caption" tone="danger">
            {problem}
          </AppText>
        )}
        <AppText variant="caption" tone="muted">
          {"Saved when you're done typing. \"Ready to go heavier\" shows once every working set of your last session reached the top."}
        </AppText>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  range: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  box: {
    width: 72,
  },
});
