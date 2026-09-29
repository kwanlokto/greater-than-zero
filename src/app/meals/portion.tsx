import { Stack, useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PortionForm } from '@/components/portion-form';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Adds some of a Saved food to a Meal, asking how much.
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  message: {
    padding: 24,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
