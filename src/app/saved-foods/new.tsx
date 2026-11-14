import { useLocalSearchParams, useRouter } from 'expo-router';

import { SavedFoodForm } from '@/components/saved-food-form';
import { Screen } from '@/components/screen';
import type { SavedFoodValues } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';

// Saves a new food. Asked for while adding food to a Meal (mealId), it then
// asks how much of it to add; otherwise it goes back to the list.
export default function NewSavedFoodScreen() {
  const { mealId } = useLocalSearchParams<{ mealId?: string }>();
  const router = useRouter();

  async function create(values: SavedFoodValues) {
    const created = await runOrAlert("Couldn't save the food", () =>
      tracker.createSavedFood(values),
    );
    if (!created) return;
    const savedFoodId = created.result.id;
    if (mealId) router.replace({ pathname: '/meals/portion', params: { mealId, savedFoodId } });
    else router.back();
  }

  return (
    <Screen>
      <SavedFoodForm initial={undefined} submitLabel="Save food" onSubmit={create} />
    </Screen>
  );
}
