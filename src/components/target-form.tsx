import { useTheme } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { parseWeight, parseWholeNumber, setPresentationFor } from '@/components/set-fields';
import { UnitPicker } from '@/components/unit-picker';
import {
  problemWithTarget,
  type Target,
  type TargetValues,
  type TrackingType,
  type WeightUnit,
} from '@/core/tracker';

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
  const { colors } = useTheme();
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
  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
  ];

  async function submit() {
    if (typed && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      <Field label="Sets">
        <TextInput
          value={sets}
          onChangeText={setSets}
          keyboardType="number-pad"
          accessibilityLabel="Target sets"
          style={inputStyle}
        />
      </Field>
      <Field label="Rep range">
        <View style={styles.row}>
          <TextInput
            value={minReps}
            onChangeText={setMinReps}
            keyboardType="number-pad"
            accessibilityLabel="Fewest reps"
            style={inputStyle}
          />
          <Text style={[styles.between, { color: colors.text }]}>to</Text>
          <TextInput
            value={maxReps}
            onChangeText={setMaxReps}
            keyboardType="number-pad"
            accessibilityLabel="Most reps"
            style={inputStyle}
          />
          <Text style={[styles.between, { color: colors.text }]}>reps</Text>
        </View>
      </Field>
      <Field label={trackingType === 'bodyweight' ? 'Added weight' : 'Weight'}>
        <View style={styles.row}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType={weightField.keyboardType}
            placeholder={weightField.placeholder}
            placeholderTextColor="#8e8e93"
            accessibilityLabel={weightField.accessibilityLabel}
            style={inputStyle}
          />
          <Text style={[styles.between, { color: colors.text }]}>{weightField.unitLabel}</Text>
        </View>
        {presentation.hint && (
          <Text style={[styles.hint, { color: colors.text }]}>{presentation.hint}</Text>
        )}
        <UnitPicker value={weightUnit} onChange={setWeightUnit} />
      </Field>
      {problem && <Text style={[styles.problem, { color: colors.notification }]}>{problem}</Text>}
      <PrimaryButton label={submitLabel} disabled={!typed || !!problem} onPress={submit} />
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      {children}
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
  const weight = parseWeight(text.weight);
  if (sets === undefined || minReps === undefined || maxReps === undefined) return undefined;
  if (weight === undefined) return undefined;
  return { sets, minReps, maxReps, weight, weightUnit: text.weightUnit };
}

const styles = StyleSheet.create({
  form: {
    gap: 24,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    width: 80,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
  },
  between: {
    fontSize: 16,
    opacity: 0.7,
  },
  hint: {
    fontSize: 13,
    opacity: 0.7,
  },
  problem: {
    fontSize: 14,
  },
});
