import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import {
  problemWithSet,
  type SetValues,
  type TrackingType,
  type Weight,
  type WeightUnit,
  type WorkoutSet,
} from '@/core/tracker';

function formatWeight(weight: Weight | null): string {
  return weight ? `${weight.value} ${weight.unit}` : '';
}

type SetPresentation = {
  weightField: (unit: WeightUnit) => {
    keyboardType: KeyboardTypeOptions;
    placeholder: string;
    unitLabel: string;
    accessibilityLabel: string;
  };
  // Shown once per Exercise, under its fields.
  hint?: string;
  describe: (set: WorkoutSet) => string;
};

// How Sets of each tracking type are entered and shown.
export const setPresentationFor: Record<TrackingType, SetPresentation> = {
  weighted: {
    weightField: unit => ({
      keyboardType: 'decimal-pad',
      placeholder: '0',
      unitLabel: unit,
      accessibilityLabel: `Weight in ${unit}`,
    }),
    // In the display unit, whatever unit the Set was entered in.
    describe: set => `${formatWeight(set.displayWeight)} × ${set.reps}`,
  },
  bodyweight: {
    weightField: unit => ({
      // The numeric keyboard has a minus key, for assisted Sets.
      keyboardType: 'numeric',
      placeholder: 'none',
      unitLabel: `${unit} added`,
      accessibilityLabel: `Added weight in ${unit}: blank for bodyweight, negative if assisted`,
    }),
    hint: 'Leave blank for bodyweight. Use a negative number for an assisted machine.',
    describe: set => {
      const added = set.displayWeight;
      // No added weight, whether left blank or entered as 0, is plain bodyweight.
      if (!added || added.value === 0) return `Bodyweight × ${set.reps}`;
      const sign = added.value < 0 ? '−' : '+';
      return `Bodyweight ${sign} ${formatWeight({ ...added, value: Math.abs(added.value) })} × ${set.reps}`;
    },
  },
};

type Initial = { weight?: string; reps?: string; isWarmUp?: boolean };

// The text in a Set's fields and its warm-up mark, plus the Set they add up to:
// undefined while it isn't one the core would accept. The core's own rule
// decides, so screens can't drift from it.
export function useSetFields(trackingType: TrackingType, unit: WeightUnit, initial: Initial = {}) {
  const [weight, setWeight] = useState(initial.weight ?? '');
  const [reps, setReps] = useState(initial.reps ?? '');
  const [isWarmUp, setIsWarmUp] = useState(initial.isWarmUp ?? false);

  return {
    fields: {
      trackingType,
      unit,
      weight,
      reps,
      onChangeWeight: setWeight,
      onChangeReps: setReps,
    },
    isWarmUp,
    setIsWarmUp,
    values: typedSet(trackingType, weight, reps, isWarmUp),
    clearReps: () => setReps(''),
  };
}

// A logged Set's fields, for correcting it.
export function initialFieldsOf(set: WorkoutSet): Initial {
  return {
    weight: set.weight === null ? '' : String(set.weight),
    reps: String(set.reps),
    isWarmUp: set.isWarmUp,
  };
}

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
  const weightField = setPresentationFor[trackingType].weightField(unit);
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

function typedSet(
  trackingType: TrackingType,
  weight: string,
  reps: string,
  isWarmUp: boolean,
): SetValues | undefined {
  const parsedWeight = parseWeight(weight);
  const parsedReps = parseWholeNumber(reps);
  if (parsedWeight === undefined || parsedReps === undefined) return undefined;
  const values = { weight: parsedWeight, reps: parsedReps, isWarmUp };
  return problemWithSet(trackingType, values) === undefined ? values : undefined;
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
