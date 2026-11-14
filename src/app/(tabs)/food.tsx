import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DailyTotalsCard } from '@/components/daily-totals-card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import type { Meal } from '@/core/tracker';
import { tracker } from '@/database';
import { formatTimeOfDay } from '@/dates';
import { formatCalories } from '@/food-labels';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';

// "8:10 AM · 3 foods", under a Meal's name.
function mealDetails(meal: Meal): string {
  const count = meal.items.length;
  const foods = count === 0 ? 'no food yet' : count === 1 ? '1 food' : `${count} foods`;
  return `${formatTimeOfDay(meal.eatenAt)} · ${foods}`;
}

// Today's totals, then today's Meals in the order eaten, one line each, and
// ways to add one. A Meal's food is on its own screen.
export default function FoodScreen() {
  const router = useRouter();
  const today = useToday();
  const meals = useTrackerQuery(() => tracker.getMeals(today), [today]);
  const dailyTotals = useTrackerQuery(() => tracker.getDailyTotals(today), [today]);

  // A new Meal, eaten now and named for the time of day, opened to add food.
  async function addMeal() {
    const added = await runOrAlert("Couldn't add a meal", () => tracker.createMeal());
    if (added) router.push({ pathname: '/meals/[id]', params: { id: added.result.id } });
  }

  return (
    <Screen
      onTab
      contentStyle={styles.content}
      fab={<Fab label="Add meal" onTab onPress={addMeal} />}
    >
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
            <ListGroup>
              {meals.map(meal => (
                <ListRow
                  key={meal.id}
                  title={meal.name}
                  subtitle={mealDetails(meal)}
                  value={`${formatCalories(meal.totals.calories)} kcal`}
                  accessibilityHint="Opens this meal for editing"
                  // navigate, not push, so a double tap can't open it twice.
                  onPress={() =>
                    router.navigate({ pathname: '/meals/[id]', params: { id: meal.id } })
                  }
                />
              ))}
            </ListGroup>
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: space.md,
  },
  shortcut: {
    flex: 1,
    paddingHorizontal: space.sm,
  },
});
