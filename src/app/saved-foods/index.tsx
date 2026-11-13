import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { tracker } from '@/database';
import { describeMacros, describeServing } from '@/food-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// Every Saved food by name, each with its Serving and macros; tapping one
// opens it for editing.
export default function SavedFoodsScreen() {
  const router = useRouter();
  const savedFoods = useTrackerQuery(() => tracker.getSavedFoods(), []);

  return (
    <Screen fab={<Fab label="New saved food" onPress={() => router.push('/saved-foods/new')} />}>
      {savedFoods && savedFoods.length === 0 && (
        <EmptyState
          icon="bookmark-outline"
          title="No saved foods yet"
          message="Save a food you eat often, and add it to a meal in a couple of taps."
        />
      )}
      {savedFoods && savedFoods.length > 0 && (
        <ListGroup>
          {savedFoods.map(food => (
            <ListRow
              key={food.id}
              title={food.name}
              subtitle={`${describeServing(food)} · ${describeMacros(food)}`}
              onPress={() =>
                router.navigate({ pathname: '/saved-foods/[id]', params: { id: food.id } })
              }
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
