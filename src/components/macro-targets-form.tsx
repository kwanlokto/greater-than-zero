import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { problemWithMacroTargets, type Macro, type MacroTargets } from '@/core/tracker';
import { macroNames, macroUnits } from '@/food-labels';
import { parseDecimal } from '@/numbers';
import { space } from '@/theme';

type Props = {
  initial: MacroTargets;
  submitLabel: string;
  onSubmit: (targets: MacroTargets) => Promise<void>;
};

const gramMacros: Macro[] = ['protein', 'carbs', 'fat'];

// How much to eat in a day, in calories and grams of each macro. A field left
// blank sets no target for it.
export function MacroTargetsForm({ initial, submitLabel, onSubmit }: Props) {
  const [text, setText] = useState(() => textOf(initial));

  const typed = typedTargets(text);
  // The core's own rule decides, so the form can't drift from it.
  const problem = typed ? problemWithMacroTargets(typed) : undefined;

  async function submit() {
    if (typed && !problem) await onSubmit(typed);
  }

  const box = (macro: Macro) => (
    <Input
      value={text[macro]}
      onChangeText={value => setText(current => ({ ...current, [macro]: value }))}
      keyboardType="decimal-pad"
      accessibilityLabel={`${macroNames[macro]} target in ${macroUnits[macro] === 'g' ? 'grams' : 'calories'}`}
      placeholder="None"
      suffix={macroUnits[macro]}
      align="right"
      strong
    />
  );

  return (
    <View style={styles.form}>
      <Field label="Calories a day">{box('calories')}</Field>
      <View style={styles.row}>
        {gramMacros.map(macro => (
          <Field key={macro} label={macroNames[macro]} style={styles.column}>
            {box(macro)}
          </Field>
        ))}
      </View>
      <AppText variant="caption" tone="muted">
        Leave any blank for no target.
      </AppText>
      {problem && <AppText tone="danger">{problem}</AppText>}
      <Button size="large" label={submitLabel} disabled={!typed || !!problem} onPress={submit} />
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
    gap: space.lg,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  column: {
    flex: 1,
  },
});
