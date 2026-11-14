import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import type { Macro, MacroTargets } from '@/core/tracker';
import { macroNames, macroUnits } from '@/food-labels';
import { macroTargetBoxesOf, readMacroTargets } from '@/form-values';
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
  const [text, setText] = useState(() => macroTargetBoxesOf(initial));
  const { values, problem } = readMacroTargets(text, initial);

  async function submit() {
    if (values) await onSubmit(values);
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
      <Button size="large" label={submitLabel} disabled={!values} onPress={submit} />
    </View>
  );
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
