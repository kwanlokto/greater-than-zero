import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { caloriesFromMacros, type FoodValues } from '@/core/tracker';
import { formatCalories } from '@/food-labels';
import { parseDecimal } from '@/numbers';
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
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [unit, setUnit] = useState(initial?.unit ?? 'g');
  const [calories, setCalories] = useState(
    initial?.calories == null ? '' : String(initial.calories),
  );
  const [macros, setMacros] = useState({
    protein: initial ? String(initial.protein) : '',
    carbs: initial ? String(initial.carbs) : '',
    fat: initial ? String(initial.fat) : '',
  });

  const typed = typedFood({ name, amount, unit, calories, ...macros });
  // The core's own rule decides, so the form can't drift from it. Only said
  // once the name, amount and unit are filled in, so it doesn't nag while typing.
  const filledIn = name.trim() !== '' && amount.trim() !== '' && unit.trim() !== '';
  const problem = typed && problemOf(typed);
  const workedOut = typed && typed.calories === null ? caloriesFromMacros(typed) : undefined;

  async function submit() {
    if (typed && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      <Field label="Name">
        <Input
          value={name}
          onChangeText={setName}
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
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              accessibilityLabel={amountLabel}
              align="right"
              strong
            />
          </Field>
          <Field label="Unit" style={styles.unit}>
            <Input
              value={unit}
              onChangeText={setUnit}
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
          value={calories}
          onChangeText={setCalories}
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
              value={macros[key]}
              onChangeText={text => setMacros(current => ({ ...current, [key]: text }))}
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
      {filledIn && problem && <AppText tone="danger">{problem}</AppText>}
      <Button size="large" label={submitLabel} disabled={!typed || !!problem} onPress={submit} />
    </View>
  );
}

// Undefined while a number field holds something that isn't a number. A blank
// amount is left for the core's rule to refuse.
function typedFood(text: Record<keyof FoodValues, string>): FoodValues | undefined {
  const amount = parseDecimal(text.amount);
  const calories = parseDecimal(text.calories);
  const protein = parseDecimal(text.protein);
  const carbs = parseDecimal(text.carbs);
  const fat = parseDecimal(text.fat);
  const numbers = [amount, calories, protein, carbs, fat];
  if (numbers.some(number => number === undefined)) return undefined;
  return {
    name: text.name,
    amount: amount ?? Number.NaN,
    unit: text.unit,
    calories: calories ?? null,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
  };
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
