import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ListGroup, ListRow } from '@/components/list-row';
import { MacroSummary } from '@/components/macro-summary';
import { NameField } from '@/components/name-field';
import { Screen } from '@/components/screen';
import { Section } from '@/components/section';
import type { Meal } from '@/core/tracker';
import { tracker } from '@/database';
import { formatTimeOfDay } from '@/dates';
import { describeFoodItem, describeMacros } from '@/food-labels';
import { confirmThenRun, runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Meal: its name, when it was eaten, its Food items and their totals.
// Every change is saved as it's made.
export default function MealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Null once there's no such Meal, e.g. after it's deleted.
  const meal = useTrackerQuery(async () => (await tracker.getMeal(id)) ?? null, [id]);

  if (meal === undefined) return null;
  if (meal === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This meal was deleted." />
      </Screen>
    );
  }

  // A new Meal today, eaten now, with this one's food, opened in its place.
  async function copyToToday() {
    let copyId: string | undefined;
    const copied = await runOrAlert("Couldn't copy the meal", async () => {
      copyId = (await tracker.copyMeal(id)).id;
    });
    if (copied && copyId) router.replace({ pathname: '/meals/[id]', params: { id: copyId } });
  }

  const confirmDelete = async () => {
    const done = await confirmThenRun(
      {
        title: `Delete ${meal.name}?`,
        message: 'Its food will be removed too.',
        decline: 'Cancel',
        accept: 'Delete',
        destructive: true,
      },
      "Couldn't delete the meal",
      () => tracker.deleteMeal(id),
    );
    if (done) router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: meal.name }} />
      <NameField
        name={meal.name}
        accessibilityLabel="Meal name"
        failureTitle="Couldn't rename the meal"
        rename={name => tracker.renameMeal(id, name)}
      />
      <ListGroup>
        <MealTimeRow meal={meal} />
      </ListGroup>
      <Section title="Totals">
        <Card>
          <MacroSummary macros={meal.totals} large />
        </Card>
      </Section>
      <Section title="Food">
        {meal.items.length === 0 ? (
          <Card>
            <EmptyState icon="restaurant-outline" title="No food yet" />
          </Card>
        ) : (
          <ListGroup>
            {meal.items.map(item => (
              <ListRow
                key={item.id}
                title={describeFoodItem(item)}
                subtitle={describeMacros(item)}
                accessibilityHint="Opens this food for editing"
                onPress={() =>
                  router.navigate({
                    pathname: '/meals/food-item',
                    params: { mealId: meal.id, foodItemId: item.id },
                  })
                }
              />
            ))}
          </ListGroup>
        )}
        <Button
          size="large"
          icon="add"
          label="Add food"
          onPress={() => router.push({ pathname: '/meals/choose-food', params: { mealId: id } })}
        />
      </Section>
      <Button variant="secondary" icon="copy-outline" label="Copy to today" onPress={copyToToday} />
      <Button variant="ghost" destructive label="Delete meal" onPress={confirmDelete} />
    </Screen>
  );
}

// When the Meal was eaten; tapping it picks another time that day.
function MealTimeRow({ meal }: { meal: Meal }) {
  const pickTime = () => {
    DateTimePickerAndroid.open({
      value: meal.eatenAt,
      mode: 'time',
      onChange: (event, picked) => {
        if (event.type !== 'set' || !picked) return;
        const time = { hours: picked.getHours(), minutes: picked.getMinutes() };
        runOrAlert("Couldn't change the time", () => tracker.setMealTime(meal.id, time));
      },
    });
  };

  return (
    <ListRow
      icon="time-outline"
      title={`Eaten at ${formatTimeOfDay(meal.eatenAt)}`}
      value="Change"
      valueTone="primary"
      trailingIcon="chevron-forward"
      accessibilityHint="Picks another time"
      onPress={pickTime}
    />
  );
}
