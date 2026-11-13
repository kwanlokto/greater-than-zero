import { useRouter } from 'expo-router';
import { Fragment, useRef } from 'react';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { MealCard } from '@/components/meal-card';
import { Screen } from '@/components/screen';
import type { Meal } from '@/core/tracker';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';

// How many past Meals to offer: about a week's worth.
const pastMealsShown = 30;

// Picks a Meal to copy into today: the latest from before today, by day, the
// most recent first. Tapping one copies it, eaten now, and goes back to
// today's Meals.
export default function ChoosePastMealScreen() {
  const router = useRouter();
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
    <Screen contentStyle={{ gap: space.md }}>
      {meals?.length === 0 && (
        <EmptyState icon="restaurant-outline" title="No meals before today yet." />
      )}
      {meals && meals.length > 0 && (
        <AppText tone="muted">Tap a meal to copy it into today, eaten now.</AppText>
      )}
      {meals?.map((meal, index) => (
        <Fragment key={meal.id}>
          {meal.localDate !== meals[index - 1]?.localDate && (
            <AppText
              accessibilityRole="header"
              variant="overline"
              tone="muted"
              style={{ marginTop: space.md, paddingHorizontal: space.xs }}
            >
              {formatLocalDateWithWeekday(meal.localDate)}
            </AppText>
          )}
          <MealCard
            meal={meal}
            action={{ label: 'Copy', icon: 'copy-outline' }}
            hint="Copies this meal into today"
            onPress={() => copy(meal)}
          />
        </Fragment>
      ))}
    </Screen>
  );
}
