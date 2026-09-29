import { useTheme } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/field';
import { PrimaryButton } from '@/components/primary-button';
import { portionOf, problemWithPortion, type SavedFood } from '@/core/tracker';
import { describeMacros, describeServing } from '@/food-labels';
import { parseDecimal } from '@/numbers';

type Props = {
  savedFood: SavedFood;
  onSubmit: (quantity: number) => Promise<void>;
};

// How much of a Saved food to add to a Meal, in its Serving unit, starting at
// one Serving and showing the macros that comes to.
export function PortionForm({ savedFood, onSubmit }: Props) {
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState(String(savedFood.servingAmount));
  const typed = parseDecimal(quantity) ?? undefined;
  // The core's own rule decides, so the form can't drift from it.
  const problem = typed === undefined ? undefined : problemWithPortion(savedFood, typed);

  async function submit() {
    if (typed !== undefined && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.details, { color: colors.text }]}>
        Per {describeServing(savedFood)}: {describeMacros(savedFood)}
      </Text>
      <Field label="Amount">
        <View style={styles.row}>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            accessibilityLabel={`Amount in ${savedFood.servingUnit}`}
            autoFocus
            selectTextOnFocus
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
            ]}
          />
          <Text style={[styles.unit, { color: colors.text }]}>{savedFood.servingUnit}</Text>
        </View>
      </Field>
      {typed !== undefined && !problem && (
        <Text style={[styles.portion, { color: colors.text }]}>
          {describeMacros(portionOf(savedFood, typed))}
        </Text>
      )}
      {problem && <Text style={[styles.problem, { color: colors.notification }]}>{problem}</Text>}
      <PrimaryButton
        label="Add to meal"
        disabled={typed === undefined || !!problem}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 24,
  },
  details: {
    fontSize: 14,
    opacity: 0.7,
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
  portion: {
    fontSize: 16,
    fontWeight: '600',
  },
  problem: {
    fontSize: 14,
  },
});
