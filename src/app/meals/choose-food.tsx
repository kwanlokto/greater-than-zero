import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppText } from '@/components/app-text';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { tracker } from '@/database';
import { describeMacros, describeServing } from '@/food-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks what to add to a Meal: a one-off Food item typed in, or a Saved food
// in a quantity, including one saved from here first.
export default function ChooseFoodScreen() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const router = useRouter();
  const savedFoods = useTrackerQuery(() => tracker.getSavedFoodsByRecentUse(), []);

  return (
    <Screen>
      <ListGroup>
        <ListRow
          icon="create-outline"
          title="One-off food"
          subtitle="Type in its macros, without saving it"
          onPress={() => router.replace({ pathname: '/meals/food-item', params: { mealId } })}
        />
        <ListRow
          icon="bookmark-outline"
          title="New saved food"
          subtitle="Save a food you eat often, then add it"
          onPress={() => router.replace({ pathname: '/saved-foods/new', params: { mealId } })}
        />
      </ListGroup>
      {savedFoods && (
        <Section title="Saved foods, most recently used first">
          {savedFoods.length === 0 ? (
            <AppText tone="muted">No saved foods yet.</AppText>
          ) : (
            <ListGroup>
              {savedFoods.map(food => (
                <ListRow
                  key={food.id}
                  title={food.name}
                  subtitle={`${describeServing(food)} · ${describeMacros(food)}`}
                  accessibilityLabel={`Add ${food.name}`}
                  trailingIcon="add-circle"
                  trailingIconTone="primary"
                  onPress={() =>
                    router.replace({
                      pathname: '/meals/portion',
                      params: { mealId, savedFoodId: food.id },
                    })
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
