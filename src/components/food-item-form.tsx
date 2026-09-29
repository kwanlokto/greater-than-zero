import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';

import { Field } from '@/components/field';
import { PrimaryButton } from '@/components/primary-button';
import {
  caloriesFromMacros,
  problemWithFoodItem,
  type FoodItem,
  type FoodItemValues,
} from '@/core/tracker';
import { formatCalories } from '@/food-labels';
import { parseDecimal } from '@/numbers';

type Props = {
  // The Food item being changed; a new one starts blank, in grams.
  initial: FoodItem | undefined;
  submitLabel: string;
  onSubmit: (values: FoodItemValues) => Promise<void>;
};

// A Food item's name, amount and macros. Calories left blank are worked out
// from the macros, and a blank macro counts as none.
export function FoodItemForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [unit, setUnit] = useState(initial?.unit ?? 'g');
  const [calories, setCalories] = useState(
    initial?.typedCalories == null ? '' : String(initial.typedCalories),
  );
  const [protein, setProtein] = useState(initial ? String(initial.protein) : '');
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs) : '');
  const [fat, setFat] = useState(initial ? String(initial.fat) : '');

  const typed = typedFoodItem({ name, quantity, unit, calories, protein, carbs, fat });
  // The core's own rule decides, so the form can't drift from it. Only said
  // once the name, amount and unit are filled in, so it doesn't nag while typing.
  const filledIn = name.trim() !== '' && quantity.trim() !== '' && unit.trim() !== '';
  const problem = typed && problemWithFoodItem(typed);
  const workedOut = typed && typed.calories === null ? caloriesFromMacros(typed) : undefined;
  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
  ];

  async function submit() {
    if (typed && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      <Field label="Name">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Greek yogurt"
          placeholderTextColor="#8e8e93"
          autoCapitalize="sentences"
          autoFocus={!initial}
          style={[inputStyle, styles.wide]}
        />
      </Field>
      <Field label="Amount">
        <View style={styles.row}>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            accessibilityLabel="Quantity"
            style={inputStyle}
          />
          <TextInput
            value={unit}
            onChangeText={setUnit}
            autoCapitalize="none"
            accessibilityLabel="Unit"
            placeholder="g, ml, scoop…"
            placeholderTextColor="#8e8e93"
            style={[inputStyle, styles.wide]}
          />
        </View>
      </Field>
      <Field label="Calories">
        <View style={styles.row}>
          <TextInput
            value={calories}
            onChangeText={setCalories}
            keyboardType="decimal-pad"
            accessibilityLabel="Calories"
            placeholder={workedOut === undefined ? '' : formatCalories(workedOut)}
            placeholderTextColor="#8e8e93"
            style={inputStyle}
          />
          <Text style={[styles.between, { color: colors.text }]}>kcal</Text>
        </View>
        <Text style={[styles.hint, { color: colors.text }]}>
          Leave blank to work them out from the macros.
        </Text>
      </Field>
      <View style={styles.row}>
        <MacroField label="Protein" value={protein} onChange={setProtein} inputStyle={inputStyle} />
        <MacroField label="Carbs" value={carbs} onChange={setCarbs} inputStyle={inputStyle} />
        <MacroField label="Fat" value={fat} onChange={setFat} inputStyle={inputStyle} />
      </View>
      {filledIn && problem && (
        <Text style={[styles.problem, { color: colors.notification }]}>{problem}</Text>
      )}
      <PrimaryButton label={submitLabel} disabled={!typed || !!problem} onPress={submit} />
    </View>
  );
}

type MacroFieldProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  inputStyle: StyleProp<TextStyle>;
};

// Grams of one macro; blank is none.
function MacroField({ label, value, onChange, inputStyle }: MacroFieldProps) {
  return (
    <Field label={`${label} (g)`}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label} in grams`}
        placeholder="0"
        placeholderTextColor="#8e8e93"
        style={inputStyle}
      />
    </Field>
  );
}

// Undefined while a number field holds something that isn't a number. A blank
// amount is left for the core's rule to refuse.
function typedFoodItem(text: Record<keyof FoodItemValues, string>): FoodItemValues | undefined {
  const quantity = parseDecimal(text.quantity);
  const calories = parseDecimal(text.calories);
  const protein = parseDecimal(text.protein);
  const carbs = parseDecimal(text.carbs);
  const fat = parseDecimal(text.fat);
  const numbers = [quantity, calories, protein, carbs, fat];
  if (numbers.some(number => number === undefined)) return undefined;
  return {
    name: text.name,
    quantity: quantity ?? Number.NaN,
    unit: text.unit,
    calories: calories ?? null,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
  };
}

const styles = StyleSheet.create({
  form: {
    gap: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    width: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
  },
  wide: {
    flex: 1,
    width: undefined,
    textAlign: 'left',
  },
  between: {
    fontSize: 16,
    opacity: 0.7,
    paddingBottom: 10,
  },
  hint: {
    fontSize: 13,
    opacity: 0.7,
  },
  problem: {
    fontSize: 14,
  },
});
