import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { setPresentationFor } from '@/components/set-fields';
import { UnitPicker } from '@/components/unit-picker';
import {
  problemWithTarget,
  type Target,
  type TargetValues,
  type TrackingType,
  type WeightUnit,
} from '@/core/tracker';
import { parseDecimal, parseWholeNumber } from '@/numbers';
import { space } from '@/theme';

type Props = {
  trackingType: TrackingType;
  // The Target being changed, or the unit a new one starts in.
  initial: Target | { weightUnit: WeightUnit };
  submitLabel: string;
  onSubmit: (values: TargetValues) => Promise<void>;
};

// A new Target starts at 3 × 8–12, the most common aim.
const newTargetDefaults = { sets: '3', minReps: '8', maxReps: '12', weight: '' };

// Sets × rep range @ weight for an Exercise in a Template. The weight is in the
// unit chosen here, the display unit to begin with.
export function TargetForm({ trackingType, initial, submitLabel, onSubmit }: Props) {
  const fields = 'sets' in initial ? fieldsOf(initial) : newTargetDefaults;
  const [sets, setSets] = useState(fields.sets);
  const [minReps, setMinReps] = useState(fields.minReps);
  const [maxReps, setMaxReps] = useState(fields.maxReps);
  const [weight, setWeight] = useState(fields.weight);
  const [weightUnit, setWeightUnit] = useState(initial.weightUnit);

  const typed = typedTarget({ sets, minReps, maxReps, weight, weightUnit });
  // The core's own rule decides, so the form can't drift from it. Only said
  // once every field holds a number, so it doesn't nag while typing.
  const problem = typed && problemWithTarget(trackingType, typed);
  const presentation = setPresentationFor[trackingType];
  const weightField = presentation.weightField(weightUnit);

  async function submit() {
    if (typed && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <Field label="Sets" style={styles.sets}>
          <Input
            value={sets}
            onChangeText={setSets}
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
              value={minReps}
              onChangeText={setMinReps}
              keyboardType="number-pad"
              accessibilityLabel="Fewest reps"
              align="center"
              strong
              selectTextOnFocus
              style={styles.flex}
            />
            <AppText tone="muted">to</AppText>
            <Input
              value={maxReps}
              onChangeText={setMaxReps}
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
          value={weight}
          onChangeText={setWeight}
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
      <Button size="large" label={submitLabel} disabled={!typed || !!problem} onPress={submit} />
    </View>
  );
}

function fieldsOf(target: Target) {
  return {
    sets: String(target.sets),
    minReps: String(target.minReps),
    maxReps: String(target.maxReps),
    weight: target.weight === null ? '' : String(target.weight),
  };
}

// Undefined while a field doesn't hold a number.
function typedTarget(text: {
  sets: string;
  minReps: string;
  maxReps: string;
  weight: string;
  weightUnit: WeightUnit;
}): TargetValues | undefined {
  const sets = parseWholeNumber(text.sets);
  const minReps = parseWholeNumber(text.minReps);
  const maxReps = parseWholeNumber(text.maxReps);
  const weight = parseDecimal(text.weight);
  if (sets === undefined || minReps === undefined || maxReps === undefined) return undefined;
  if (weight === undefined) return undefined;
  return { sets, minReps, maxReps, weight, weightUnit: text.weightUnit };
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
