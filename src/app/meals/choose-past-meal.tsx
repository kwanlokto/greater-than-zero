import { useRouter, useTheme } from 'expo-router';
import { Fragment, useRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { MealCard } from '@/components/meal-card';
import type { Meal } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';

// How many past Meals to offer: about a week's worth.
const pastMealsShown = 30;

// Picks a Meal to copy into today: the latest from before today, by day, the
// most recent first. Tapping one copies it, eaten now, and goes back to
// today's Meals.
export default function ChoosePastMealScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const today = useToday();
  const meals = useTrackerQuery(() => tracker.getMealsBefore(today, pastMealsShown), [today]);
  // One tap copies one Meal, even if the lifter taps again while leaving.
  const copying = useRef(false);

  async function copy(meal: Meal) {
    if (copying.current) return;
    copying.current = true;
    if (await runOrAlert("Couldn't copy the meal", () => tracker.copyMeal(meal.id))) router.back();
    else copying.current = false;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {meals?.length === 0 && (
        <Text style={[styles.note, { color: colors.text }]}>No meals before today yet.</Text>
      )}
      {meals?.map((meal, index) => (
        <Fragment key={meal.id}>
          {meal.localDate !== meals[index - 1]?.localDate && (
            <Text style={[styles.day, { color: colors.text }]}>
              {formatLocalDateWithWeekday(meal.localDate)}
            </Text>
          )}
          <MealCard
            meal={meal}
            icon="copy-outline"
            hint="Copies this meal into today"
            onPress={() => copy(meal)}
          />
        </Fragment>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  day: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  note: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
