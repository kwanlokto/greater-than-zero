import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { canAddToRotation, type Category } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks a Category to add to the end of a Rotation, from those it can take.
export default function ChooseRotationCategoryScreen() {
  const { rotationId } = useLocalSearchParams<{ rotationId: string }>();
  const router = useRouter();
  const categories = useTrackerQuery(async () => {
    const [all, rotation] = await Promise.all([
      tracker.getCategories(),
      tracker.getRotation(rotationId),
    ]);
    return {
      hasCategories: all.length > 0,
      addable: rotation ? all.filter(({ id }) => canAddToRotation(rotation, id)) : [],
    };
  }, [rotationId]);

  async function add(category: Category) {
    const added = await runOrAlert("Couldn't add the category", () =>
      tracker.addCategoryToRotation(rotationId, category.id),
    );
    if (added) router.back();
  }

  if (!categories) return null;

  return (
    <Screen>
      {categories.addable.length > 0 && (
        <ListGroup>
          {categories.addable.map(category => (
            <ListRow
              key={category.id}
              title={category.name}
              accessibilityLabel={`Add ${category.name}`}
              trailingIcon="add-circle"
              trailingIconTone="primary"
              // Guarded by the row: a double tap adds it once.
              onPress={() => add(category)}
            />
          ))}
        </ListGroup>
      )}
      {categories.addable.length === 0 &&
        (categories.hasCategories ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Every category is already in this rotation."
          />
        ) : (
          <EmptyState
            icon="pricetag-outline"
            title="No categories yet"
            message="Give a workout a category, such as Push, by tapping its title. Then add it here."
          />
        ))}
    </Screen>
  );
}
