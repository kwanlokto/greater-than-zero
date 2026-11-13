import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { PortionForm } from '@/components/portion-form';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Adds some of a Saved food to a Meal, asking how much.
export default function PortionScreen() {
  const { mealId, savedFoodId } = useLocalSearchParams<{ mealId: string; savedFoodId: string }>();
  const router = useRouter();
  // Null once there's no such Saved food, e.g. after it's deleted.
  const savedFood = useTrackerQuery(
    async () => (await tracker.getSavedFood(savedFoodId)) ?? null,
    [savedFoodId],
  );

  if (savedFood === undefined) return null;
  if (savedFood === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This food was deleted." />
      </Screen>
    );
  }

  async function add(quantity: number) {
    const added = await runOrAlert("Couldn't add the food", () =>
      tracker.addSavedFoodToMeal(mealId, savedFoodId, quantity),
    );
    if (added) router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: savedFood.name }} />
      <PortionForm savedFood={savedFood} onSubmit={add} />
    </Screen>
  );
}
