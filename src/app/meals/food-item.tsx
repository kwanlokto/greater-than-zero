import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FoodItemForm } from '@/components/food-item-form';
import { Screen } from '@/components/screen';
import type { FoodItem, FoodItemValues } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Either a one-off Food item being added to a Meal, or one in it (foodItemId)
// being changed.
type Params = { mealId: string; foodItemId?: string };

export default function FoodItemScreen() {
  const { mealId, foodItemId } = useLocalSearchParams<Params>();
  const router = useRouter();
  // Null once there's nothing to edit, e.g. after the Meal or this Food item
  // in it is deleted.
  const loaded = useTrackerQuery(async () => {
    const meal = await tracker.getMeal(mealId);
    if (!meal) return null;
    if (!foodItemId) return { item: undefined };
    const item = meal.items.find(({ id }) => id === foodItemId);
    return item ? { item } : null;
  }, [mealId, foodItemId]);

  if (loaded === undefined) return null;
  if (loaded === null) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="This food is no longer in the meal." />
      </Screen>
    );
  }

  async function save(values: FoodItemValues) {
    const saved = await runOrAlert("Couldn't save the food", async () => {
      if (foodItemId) await tracker.editFoodItem(foodItemId, values);
      else await tracker.addFoodItem(mealId, values);
    });
    if (saved) router.back();
  }

  const confirmRemove = (item: FoodItem) => {
    Alert.alert(`Remove ${item.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (await runOrAlert("Couldn't remove the food", () => tracker.deleteFoodItem(item.id))) {
            router.back();
          }
        },
      },
    ]);
  };

  const { item } = loaded;
  return (
    <Screen>
      <Stack.Screen options={{ title: item ? 'Edit food' : 'Add food' }} />
      <FoodItemForm initial={item} submitLabel={item ? 'Save' : 'Add food'} onSubmit={save} />
      {item && (
        <Button
          variant="ghost"
          destructive
          label="Remove food"
          onPress={() => confirmRemove(item)}
        />
      )}
    </Screen>
  );
}
