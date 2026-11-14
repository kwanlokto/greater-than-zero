import { useState } from 'react';
import { StyleSheet, type KeyboardTypeOptions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Input } from '@/components/input';

import type { TrackingType, WeightUnit, WorkoutSet } from '@/core/tracker';
import { readSet, setBoxesOf, type SetBoxes } from '@/form-values';

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

// A logged Set being corrected, or a planned Set being confirmed.
type OpenedSet = Pick<WorkoutSet, 'weight' | 'reps'> & { isWarmUp?: boolean };

// The text in a Set's boxes and its warm-up mark, read by form-values: the Set
// they add up to once the core would accept it, or the problem to show under
// the row.
export function useSetFields(trackingType: TrackingType, unit: WeightUnit, opened?: OpenedSet) {
  const [boxes, setBoxes] = useState<SetBoxes>(() =>
    opened ? setBoxesOf(opened) : { weight: '', reps: '' },
  );
  const [isWarmUp, setIsWarmUp] = useState(opened?.isWarmUp ?? false);
  const { values, problem } = readSet(trackingType, boxes, isWarmUp, opened);

  return {
    fields: {
      trackingType,
      unit,
      weight: boxes.weight,
      reps: boxes.reps,
      onChangeWeight: (weight: string) => setBoxes(current => ({ ...current, weight })),
      onChangeReps: (reps: string) => setBoxes(current => ({ ...current, reps })),
    },
    isWarmUp,
    setIsWarmUp,
    values,
    problem,
    clearReps: () => setBoxes(current => ({ ...current, reps: '' })),
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
