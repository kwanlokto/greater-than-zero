import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { setPresentationFor } from '@/components/set-fields';
import { UnitPicker } from '@/components/unit-picker';
import type { Target, TargetValues, TrackingType, WeightUnit } from '@/core/tracker';
import { readTarget, targetBoxesOf, type TargetBoxes } from '@/form-values';
import { space } from '@/theme';

type Props = {
  trackingType: TrackingType;
  // The Target being changed, or the unit a new one starts in.
  initial: Target | { weightUnit: WeightUnit };
  submitLabel: string;
  onSubmit: (values: TargetValues) => Promise<void>;
};

// A new Target starts at 3 × 8–12, the most common aim.
const newTargetBoxes: TargetBoxes = { sets: '3', minReps: '8', maxReps: '12', weight: '' };

// Sets × rep range @ weight for an Exercise in a Template. The weight is in the
// unit chosen here, the display unit to begin with.
export function TargetForm({ trackingType, initial, submitLabel, onSubmit }: Props) {
  const opened = 'sets' in initial ? initial : undefined;
  const [boxes, setBoxes] = useState(() => (opened ? targetBoxesOf(opened) : newTargetBoxes));
  const [weightUnit, setWeightUnit] = useState(initial.weightUnit);

  const { values, problem } = readTarget(trackingType, boxes, weightUnit, opened);
  const presentation = setPresentationFor[trackingType];
  const weightField = presentation.weightField(weightUnit);
  const box = (key: keyof TargetBoxes) => ({
    value: boxes[key],
    onChangeText: (text: string) => setBoxes(current => ({ ...current, [key]: text })),
  });

  async function submit() {
    if (values) await onSubmit(values);
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <Field label="Sets" style={styles.sets}>
          <Input
            {...box('sets')}
            keyboardType="number-pad"
            accessibilityLabel="Target sets"
            align="center"
            strong
            selectTextOnFocus
          />
        </Field>
        <Field label="Rep range" style={styles.reps}>
          <View style={styles.row}>
            <Input
              {...box('minReps')}
              keyboardType="number-pad"
              accessibilityLabel="Fewest reps"
              align="center"
              strong
              selectTextOnFocus
              style={styles.flex}
            />
            <AppText tone="muted">to</AppText>
            <Input
              {...box('maxReps')}
              keyboardType="number-pad"
              accessibilityLabel="Most reps"
              align="center"
              strong
              selectTextOnFocus
              style={styles.flex}
            />
          </View>
        </Field>
      </View>
      <Field
        label={trackingType === 'bodyweight' ? 'Added weight' : 'Weight'}
        hint={presentation.hint}
      >
        <Input
          {...box('weight')}
          keyboardType={weightField.keyboardType}
          placeholder={weightField.placeholder}
          accessibilityLabel={weightField.accessibilityLabel}
          suffix={weightField.unitLabel}
          align="right"
          strong
        />
        <UnitPicker value={weightUnit} onChange={setWeightUnit} />
      </Field>
      {problem && <AppText tone="danger">{problem}</AppText>}
      <Button size="large" label={submitLabel} disabled={!values} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sets: {
    width: 88,
  },
  reps: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
