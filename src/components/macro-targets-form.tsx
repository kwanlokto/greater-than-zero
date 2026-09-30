import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/field';
import { PrimaryButton } from '@/components/primary-button';
import { problemWithMacroTargets, type Macro, type MacroTargets } from '@/core/tracker';
import { macroNames, macros, macroUnits } from '@/food-labels';
import { parseDecimal } from '@/numbers';

type Props = {
  initial: MacroTargets;
  submitLabel: string;
  onSubmit: (targets: MacroTargets) => Promise<void>;
};

// How much to eat in a day, in calories and grams of each macro. A field left
// blank sets no target for it.
export function MacroTargetsForm({ initial, submitLabel, onSubmit }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => textOf(initial));

  const typed = typedTargets(text);
  // The core's own rule decides, so the form can't drift from it.
  const problem = typed ? problemWithMacroTargets(typed) : undefined;
  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
  ];

  async function submit() {
    if (typed && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      {macros.map(macro => (
        <Field key={macro} label={macroNames[macro]}>
          <View style={styles.row}>
            <TextInput
              value={text[macro]}
              onChangeText={value => setText(current => ({ ...current, [macro]: value }))}
              keyboardType="decimal-pad"
              accessibilityLabel={`${macroNames[macro]} target`}
              placeholder="None"
              placeholderTextColor="#8e8e93"
              style={inputStyle}
            />
            <Text style={[styles.unit, { color: colors.text }]}>{macroUnits[macro]} a day</Text>
          </View>
        </Field>
      ))}
      {problem && <Text style={[styles.problem, { color: colors.notification }]}>{problem}</Text>}
      <PrimaryButton label={submitLabel} disabled={!typed || !!problem} onPress={submit} />
    </View>
  );
}

// The targets as they're typed in: blank for none.
function textOf(targets: MacroTargets): Record<Macro, string> {
  const textOfTarget = (target: number | null) => (target === null ? '' : String(target));
  return {
    calories: textOfTarget(targets.calories),
    protein: textOfTarget(targets.protein),
    carbs: textOfTarget(targets.carbs),
    fat: textOfTarget(targets.fat),
  };
}

// Undefined while a field holds something that isn't a number. Blank is null.
function typedTargets(text: Record<Macro, string>): MacroTargets | undefined {
  const calories = parseDecimal(text.calories);
  const protein = parseDecimal(text.protein);
  const carbs = parseDecimal(text.carbs);
  const fat = parseDecimal(text.fat);
  if (calories === undefined || protein === undefined) return undefined;
  if (carbs === undefined || fat === undefined) return undefined;
  return { calories, protein, carbs, fat };
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    width: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
  },
  unit: {
    fontSize: 16,
    opacity: 0.7,
  },
  problem: {
    fontSize: 14,
  },
});
