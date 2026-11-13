import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DailyTotalsCard } from '@/components/daily-totals-card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { MealCard } from '@/components/meal-card';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';

// Today's totals, then today's Meals in the order eaten, and ways to add one.
export default function FoodScreen() {
  const router = useRouter();
  const today = useToday();
  const meals = useTrackerQuery(() => tracker.getMeals(today), [today]);
  const dailyTotals = useTrackerQuery(() => tracker.getDailyTotals(today), [today]);

  // A new Meal, eaten now and named for the time of day, opened to add food.
  async function addMeal() {
    let id: string | undefined;
    const added = await runOrAlert("Couldn't add a meal", async () => {
      id = (await tracker.createMeal()).id;
    });
    if (added && id) router.push({ pathname: '/meals/[id]', params: { id } });
  }

  return (
    <Screen onTab fab={<Fab label="Add meal" onTab onPress={addMeal} />}>
      {dailyTotals && <DailyTotalsCard totals={dailyTotals} />}
      <View style={styles.shortcuts}>
        <Button
          variant="secondary"
          icon="copy-outline"
          label="Copy a meal"
          accessibilityLabel="Copy a past meal"
          onPress={() => router.navigate('/meals/choose-past-meal')}
          style={styles.shortcut}
        />
        <Button
          variant="secondary"
          icon="bookmark-outline"
          label="Saved foods"
          onPress={() => router.navigate('/saved-foods')}
          style={styles.shortcut}
        />
      </View>
      {meals && (
        <Section title="Today's meals">
          {meals.length === 0 ? (
            <EmptyState
              icon="restaurant-outline"
              title="No meals yet today"
              message="Add one with the button below, or copy one you've had before."
            />
          ) : (
            meals.map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                // navigate, not push, so a double tap can't open it twice.
                onPress={() =>
                  router.navigate({ pathname: '/meals/[id]', params: { id: meal.id } })
                }
              />
            ))
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: {
    flexDirection: 'row',
    gap: space.md,
  },
  shortcut: {
    flex: 1,
    paddingHorizontal: space.sm,
  },
});
