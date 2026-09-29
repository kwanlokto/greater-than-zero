import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { FoodForm, type FoodFields } from '@/components/food-form';
import { problemWithSavedFood } from '@/core/tracker';
import { tracker } from '@/database';
import { savedFoodValuesOf } from '@/food-fields';
import { servingHint } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';

// Saves a new food, then goes back to where it was asked for: the list of
// Saved foods, or choosing food for a Meal.
export default function NewSavedFoodScreen() {
  const router = useRouter();

  async function create(fields: FoodFields) {
    const values = savedFoodValuesOf(fields);
    if (await runOrAlert("Couldn't save the food", () => tracker.createSavedFood(values))) {
      router.back();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <FoodForm
        initial={undefined}
        amountLabel="Serving"
        amountHint={servingHint}
        problemOf={fields => problemWithSavedFood(savedFoodValuesOf(fields))}
        submitLabel="Save food"
        onSubmit={create}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
