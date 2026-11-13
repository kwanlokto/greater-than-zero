import { useState } from 'react';
import { StyleSheet, type KeyboardTypeOptions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Input } from '@/components/input';

import {
  problemWithSet,
  type SetValues,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@/core/tracker';
import { parseDecimal, parseWholeNumber } from '@/numbers';

type SetPresentation = {
  weightField: (unit: WeightUnit) => {
    keyboardType: KeyboardTypeOptions;
    placeholder: string;
    // In a Set's own box, where there's only room for a word.
    shortPlaceholder: string;
    unitLabel: string;
    accessibilityLabel: string;
  };
  // Shown once per Exercise, under its fields.
  hint?: string;
};

// How Sets of each tracking type are entered. describeSet in the core shows them.
export const setPresentationFor: Record<TrackingType, SetPresentation> = {
  weighted: {
    weightField: unit => ({
      keyboardType: 'decimal-pad',
      placeholder: '0',
      shortPlaceholder: '0',
      unitLabel: unit,
      accessibilityLabel: `Weight in ${unit}`,
    }),
  },
  bodyweight: {
    weightField: unit => ({
      // The numeric keyboard has a minus key, for assisted Sets.
      keyboardType: 'numeric',
      placeholder: 'none',
      shortPlaceholder: '+0',
      unitLabel: `${unit} added`,
      accessibilityLabel: `Added weight in ${unit}: blank for bodyweight, negative if assisted`,
    }),
    hint: 'Leave blank for bodyweight. Use a negative number for an assisted machine.',
  },
};

// Warm-ups are marked W; working Sets are numbered among themselves. Labels
// for any planned Sets follow, numbered on from the working Sets.
export function setLabels(sets: WorkoutSet[], plannedCount = 0): string[] {
  let working = 0;
  const logged = sets.map(set => (set.isWarmUp ? 'W' : String(++working)));
  const planned = Array.from({ length: plannedCount }, () => String(++working));
  return [...logged, ...planned];
}

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

// A logged Set's fields, for correcting it, or a planned Set's, for confirming it.
export function initialFieldsOf(
  set: Pick<WorkoutSet, 'weight' | 'reps'> & { isWarmUp?: boolean },
): Initial {
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

// Weight and reps boxes for a Set, read as "60 kg × 8". They share whatever
// room the row has, so they fit beside a Set's number and its Log button on a
// narrow phone.
export function SetFields({
  trackingType,
  unit,
  weight,
  reps,
  onChangeWeight,
  onChangeReps,
}: Props) {
  const weightField = setPresentationFor[trackingType].weightField(unit);

  return (
    <>
      <Input
        value={weight}
        onChangeText={onChangeWeight}
        keyboardType={weightField.keyboardType}
        placeholder={weightField.shortPlaceholder}
        accessibilityLabel={weightField.accessibilityLabel}
        suffix={unit}
        align="right"
        strong
        selectTextOnFocus
        style={styles.weight}
      />
      <AppText tone="muted" style={styles.times}>
        ×
      </AppText>
      <Input
        value={reps}
        onChangeText={onChangeReps}
        keyboardType="number-pad"
        placeholder="reps"
        accessibilityLabel="Reps"
        align="center"
        strong
        selectTextOnFocus
        style={styles.reps}
      />
    </>
  );
}

function typedSet(
  trackingType: TrackingType,
  weight: string,
  reps: string,
  isWarmUp: boolean,
): SetValues | undefined {
  const parsedWeight = parseDecimal(weight);
  const parsedReps = parseWholeNumber(reps);
  if (parsedWeight === undefined || parsedReps === undefined) return undefined;
  const values = { weight: parsedWeight, reps: parsedReps, isWarmUp };
  return problemWithSet(trackingType, values) === undefined ? values : undefined;
}

const styles = StyleSheet.create({
  weight: {
    flex: 1.35,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  times: {
    fontSize: 18,
  },
  reps: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
  },
});
