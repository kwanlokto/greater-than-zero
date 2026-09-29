import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/field';
import { PrimaryButton } from '@/components/primary-button';
import {
  foodItemFromSavedFood,
  portionOf,
  problemWithFoodItem,
  type SavedFood,
} from '@/core/tracker';
import { tracker } from '@/database';
import { describeMacros, describeServing } from '@/food-labels';
import { parseDecimal } from '@/numbers';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// How much of a Saved food to add to a Meal, in its Serving unit, showing the
// macros that comes to.
export default function PortionScreen() {
  const { mealId, savedFoodId } = useLocalSearchParams<{ mealId: string; savedFoodId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  // Null once there's no such Saved food, e.g. after it's deleted.
  const savedFood = useTrackerQuery(
    async () => (await tracker.getSavedFood(savedFoodId)) ?? null,
    [savedFoodId],
  );

  if (savedFood === undefined) return null;
  if (savedFood === null) {
    return <Text style={[styles.message, { color: colors.text }]}>This food was deleted.</Text>;
  }

  async function add(quantity: number) {
    const added = await runOrAlert("Couldn't add the food", () =>
      tracker.addSavedFoodToMeal(mealId, savedFoodId, quantity),
    );
    if (added) router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: savedFood.name }} />
      <PortionForm savedFood={savedFood} onSubmit={add} />
    </ScrollView>
  );
}

type FormProps = {
  savedFood: SavedFood;
  onSubmit: (quantity: number) => Promise<void>;
};

// Starts at one Serving.
function PortionForm({ savedFood, onSubmit }: FormProps) {
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState(String(savedFood.servingAmount));
  const typed = parseDecimal(quantity);
  // The core's own rule for the Food item it would add.
  const problem =
    typed === undefined || typed === null
      ? undefined
      : problemWithFoodItem(foodItemFromSavedFood(savedFood, typed));
  const canAdd = typed !== undefined && typed !== null && !problem;

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
      {canAdd && (
        <Text style={[styles.portion, { color: colors.text }]}>
          {describeMacros(portionOf(savedFood, typed))}
        </Text>
      )}
      {problem && <Text style={[styles.problem, { color: colors.notification }]}>{problem}</Text>}
      <PrimaryButton
        label="Add to meal"
        disabled={!canAdd}
        onPress={async () => {
          if (canAdd) await onSubmit(typed);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
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
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
