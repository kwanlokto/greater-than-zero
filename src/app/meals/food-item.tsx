import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { FoodForm, type FoodFields } from '@/components/food-form';
import { TextButton } from '@/components/text-button';
import { problemWithFoodItem, type FoodItem } from '@/core/tracker';
import { tracker } from '@/database';
import { fieldsOfFoodItem, foodItemValuesOf } from '@/food-fields';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Either a one-off Food item being added to a Meal, or one in it (foodItemId)
// being changed.
type Params = { mealId: string; foodItemId?: string };

export default function FoodItemScreen() {
  const { mealId, foodItemId } = useLocalSearchParams<Params>();
  const router = useRouter();
  const { colors } = useTheme();
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
      <Text style={[styles.message, { color: colors.text }]}>
        This food is no longer in the meal.
      </Text>
    );
  }

  async function save(fields: FoodFields) {
    const values = foodItemValuesOf(fields);
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: item ? 'Edit food' : 'Add food' }} />
      <FoodForm
        initial={item && fieldsOfFoodItem(item)}
        amountLabel="Amount"
        problemOf={fields => problemWithFoodItem(foodItemValuesOf(fields))}
        submitLabel={item ? 'Save' : 'Add food'}
        onSubmit={save}
      />
      {item && <TextButton label="Remove food" destructive onPress={() => confirmRemove(item)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
