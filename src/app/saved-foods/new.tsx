import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { SavedFoodForm } from '@/components/saved-food-form';
import type { SavedFoodValues } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// Saves a new food. Asked for while adding food to a Meal (mealId), it then
// asks how much of it to add; otherwise it goes back to the list.
export default function NewSavedFoodScreen() {
  const { mealId } = useLocalSearchParams<{ mealId?: string }>();
  const router = useRouter();

  async function create(values: SavedFoodValues) {
    let savedFoodId: string | undefined;
    const created = await runOrAlert("Couldn't save the food", async () => {
      savedFoodId = (await tracker.createSavedFood(values)).id;
    });
    if (!created || !savedFoodId) return;
    if (mealId) router.replace({ pathname: '/meals/portion', params: { mealId, savedFoodId } });
    else router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SavedFoodForm initial={undefined} submitLabel="Save food" onSubmit={create} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
