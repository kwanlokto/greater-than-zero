import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { MacroSummary } from '@/components/macro-summary';
import { portionOf, problemWithPortion, type SavedFood } from '@/core/tracker';
import { describeServing, roundedAmount } from '@/food-labels';
import { parseDecimal } from '@/numbers';
import { space } from '@/theme';

type Props = {
  savedFood: SavedFood;
  onSubmit: (quantity: number) => Promise<void>;
};

// Common portions, as Servings, to pick without typing.
const servingMultiples = [0.5, 1, 1.5, 2];

// How much of a Saved food to add to a Meal, in its Serving unit, starting at
// one Serving and showing the macros that comes to.
export function PortionForm({ savedFood, onSubmit }: Props) {
  const [quantity, setQuantity] = useState(String(savedFood.servingAmount));
  const typed = parseDecimal(quantity) ?? undefined;
  // The core's own rule decides, so the form can't drift from it.
  const problem = typed === undefined ? undefined : problemWithPortion(savedFood, typed);
  const { servingAmount, servingUnit } = savedFood;

  async function submit() {
    if (typed !== undefined && !problem) await onSubmit(typed);
  }

  return (
    <View style={styles.form}>
      <Card>
        <AppText variant="label" tone="muted">
          Per {describeServing(savedFood)}
        </AppText>
        <MacroSummary macros={savedFood} />
      </Card>
      <Field label="Amount">
        <Input
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          accessibilityLabel={`Amount in ${servingUnit}`}
          autoFocus
          selectTextOnFocus
          suffix={servingUnit}
          align="right"
          strong
        />
        <View style={styles.chips}>
          {servingMultiples.map(multiple => {
            const amount = roundedAmount(servingAmount * multiple);
            return (
              <Chip
                key={multiple}
                label={`${amount} ${servingUnit}`}
                selected={typed === amount}
                onPress={() => setQuantity(String(amount))}
              />
            );
          })}
        </View>
      </Field>
      {typed !== undefined && !problem && (
        <Card>
          <AppText variant="label" tone="muted">
            This portion
          </AppText>
          <MacroSummary macros={portionOf(savedFood, typed)} large />
        </Card>
      )}
      {problem && <AppText tone="danger">{problem}</AppText>}
      <Button
        size="large"
        label="Add to meal"
        disabled={typed === undefined || !!problem}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
