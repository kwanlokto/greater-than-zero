import { useRouter, useTheme } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { MealCard } from '@/components/meal-card';
import { PrimaryButton } from '@/components/primary-button';
import { localDateOf } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Today's Meals, in the order eaten, and a way to add one.
export default function FoodScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const today = localDateOf(new Date());
  const meals = useTrackerQuery(() => tracker.getMeals(today), [today]);

  // A new Meal, eaten now and named for the time of day, opened to add food.
  async function addMeal() {
    let id: string | undefined;
    const added = await runOrAlert("Couldn't add a meal", async () => {
      id = (await tracker.addMeal()).id;
    });
    if (added && id) router.push({ pathname: '/meals/[id]', params: { id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PrimaryButton label="Add meal" onPress={addMeal} />
      {meals?.length === 0 && (
        <Text style={[styles.note, { color: colors.text }]}>No meals yet today.</Text>
      )}
      {meals?.map(meal => (
        <MealCard
          key={meal.id}
          meal={meal}
          // navigate, not push, so a double tap can't open it twice.
          onPress={() => router.navigate({ pathname: '/meals/[id]', params: { id: meal.id } })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  note: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
