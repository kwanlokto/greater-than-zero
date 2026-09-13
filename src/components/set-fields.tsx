import { useTheme } from 'expo-router';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import {
  problemWithSet,
  type NewSet,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@/core/tracker';

// How the weight field reads for each tracking type.
const weightFieldFor: Record<
  TrackingType,
  (unit: WeightUnit) => {
    keyboardType: KeyboardTypeOptions;
    placeholder: string;
    unitLabel: string;
    accessibilityLabel: string;
  }
> = {
  weighted: unit => ({
    keyboardType: 'decimal-pad',
    placeholder: '0',
    unitLabel: unit,
    accessibilityLabel: `Weight in ${unit}`,
  }),
  bodyweight: unit => ({
    // The numeric keyboard has a minus key, for assisted Sets.
    keyboardType: 'numeric',
    placeholder: 'none',
    unitLabel: `${unit} added`,
    accessibilityLabel: `Added weight in ${unit}: blank for bodyweight, negative if assisted`,
  }),
};

// Shown once per Exercise, under its fields.
export const weightHintFor: Record<TrackingType, string | undefined> = {
  weighted: undefined,
  bodyweight: 'Leave blank for bodyweight. Use a negative number for an assisted machine.',
};

type Props = {
  trackingType: TrackingType;
  unit: WeightUnit;
  weight: string;
  reps: string;
  onChangeWeight: (text: string) => void;
  onChangeReps: (text: string) => void;
};

// Weight and reps inputs for a Set, laid out for the Exercise's tracking type.
export function SetFields({ trackingType, unit, weight, reps, onChangeWeight, onChangeReps }: Props) {
  const { colors } = useTheme();
  const weightField = weightFieldFor[trackingType](unit);
  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
  ];

  return (
    <>
      <View style={styles.field}>
        <TextInput
          value={weight}
          onChangeText={onChangeWeight}
          keyboardType={weightField.keyboardType}
          placeholder={weightField.placeholder}
          placeholderTextColor="#8e8e93"
          accessibilityLabel={weightField.accessibilityLabel}
          style={inputStyle}
        />
        <Text style={[styles.unit, { color: colors.text }]}>{weightField.unitLabel}</Text>
      </View>
      <View style={styles.field}>
        <TextInput
          value={reps}
          onChangeText={onChangeReps}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#8e8e93"
          accessibilityLabel="Reps"
          style={inputStyle}
        />
        <Text style={[styles.unit, { color: colors.text }]}>reps</Text>
      </View>
    </>
  );
}

// The Set typed into the fields, or undefined while it isn't one the core would
// accept. The core's own rule decides, so screens can't drift from it.
export function typedSet(trackingType: TrackingType, weight: string, reps: string): NewSet | undefined {
  const parsedWeight = parseWeight(weight);
  const parsedReps = parseWholeNumber(reps);
  if (parsedWeight === undefined || parsedReps === undefined) return undefined;
  const set = { weight: parsedWeight, reps: parsedReps };
  return problemWithSet(trackingType, set) === undefined ? set : undefined;
}

// A logged Set's values as field text, for correcting it.
export function fieldTextOf(set: WorkoutSet): { weight: string; reps: string } {
  return { weight: set.weight === null ? '' : String(set.weight), reps: String(set.reps) };
}

// Null when blank, undefined when it isn't a number. Accepts a comma as the
// decimal separator too, as some keyboards type one.
function parseWeight(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

function parseWholeNumber(text: string): number | undefined {
  return /^\d+$/.test(text.trim()) ? Number(text) : undefined;
}

const styles = StyleSheet.create({
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
