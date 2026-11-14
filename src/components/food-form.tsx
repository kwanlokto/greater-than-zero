import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import type { FoodValues } from '@/core/tracker';
import { formatCalories } from '@/food-labels';
import { caloriesWorkedOut, foodBoxesOf, readFood, type FoodBoxes } from '@/form-values';
import { space } from '@/theme';

type Props = {
  // The food being changed; a new one starts blank, in grams.
  initial: FoodValues | undefined;
  // What the amount is called, e.g. "Amount" or "Serving", and what it means.
  amountLabel: string;
  amountHint?: string;
  // The core's rule for this kind of food, which decides when it can be saved.
  problemOf: (values: FoodValues) => string | undefined;
  submitLabel: string;
  onSubmit: (values: FoodValues) => Promise<void>;
};

const macroFields = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
] as const;

const newFoodBoxes: FoodBoxes = {
  name: '',
  amount: '',
  unit: 'g',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
};

// A food's name, amount and macros, for a Food item (FoodItemForm) or a Saved
// food (SavedFoodForm). Calories left blank are worked out from the macros,
// and a blank macro counts as none.
export function FoodForm({
  initial,
  amountLabel,
  amountHint,
  problemOf,
  submitLabel,
  onSubmit,
}: Props) {
  const [boxes, setBoxes] = useState(() => (initial ? foodBoxesOf(initial) : newFoodBoxes));
  const { values, problem } = readFood(boxes, problemOf, initial);
  const workedOut = boxes.calories.trim() === '' ? caloriesWorkedOut(boxes, initial) : undefined;
  const box = (key: keyof FoodBoxes) => ({
    value: boxes[key],
    onChangeText: (text: string) => setBoxes(current => ({ ...current, [key]: text })),
  });

  async function submit() {
    if (values) await onSubmit(values);
  }

  return (
    <View style={styles.form}>
      <Field label="Name">
        <Input
          {...box('name')}
          placeholder="e.g. Greek yogurt"
          autoCapitalize="sentences"
          autoFocus={!initial}
          strong
        />
      </Field>
      <View>
        <View style={styles.row}>
          <Field label={amountLabel} style={styles.amount}>
            <Input
              {...box('amount')}
              keyboardType="decimal-pad"
              accessibilityLabel={amountLabel}
              align="right"
              strong
            />
          </Field>
          <Field label="Unit" style={styles.unit}>
            <Input
              {...box('unit')}
              autoCapitalize="none"
              accessibilityLabel="Unit"
              placeholder="g, ml, scoop…"
            />
          </Field>
        </View>
        {amountHint && (
          <AppText variant="caption" tone="muted" style={styles.hint}>
            {amountHint}
          </AppText>
        )}
      </View>
      <Field label="Calories" hint="Leave blank to work them out from the macros.">
        <Input
          {...box('calories')}
          keyboardType="decimal-pad"
          accessibilityLabel="Calories"
          placeholder={workedOut === undefined ? '' : formatCalories(workedOut)}
          suffix="kcal"
          align="right"
          strong
        />
      </Field>
      <View style={styles.row}>
        {macroFields.map(({ key, label }) => (
          <Field key={key} label={label} style={styles.macro}>
            <Input
              {...box(key)}
              keyboardType="decimal-pad"
              accessibilityLabel={`${label} in grams`}
              placeholder="0"
              suffix="g"
              align="right"
              strong
            />
          </Field>
        ))}
      </View>
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
    gap: space.sm,
  },
  amount: {
    flex: 1,
  },
  unit: {
    flex: 1.2,
  },
  macro: {
    flex: 1,
  },
  hint: {
    marginTop: space.sm,
  },
});
