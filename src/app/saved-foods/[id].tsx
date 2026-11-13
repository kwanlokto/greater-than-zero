import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { SavedFoodForm } from '@/components/saved-food-form';
import { Screen } from '@/components/screen';
import type { SavedFoodValues } from '@/core/tracker';
import { tracker } from '@/database';
import { confirmThenRun, runOrAlert } from '@/run-or-alert';
import { useTrackerQuery } from '@/use-tracker-query';

// One Saved food, to change or delete. Meals it was added to keep the macros
// they were logged with either way.
export default function SavedFoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Null once there's no such Saved food, e.g. after it's deleted.
  const savedFood = useTrackerQuery(async () => (await tracker.getSavedFood(id)) ?? null, [id]);

  if (savedFood === undefined) return null;
  if (savedFood === null) {
    return (
      <Screen>
        <EmptyState icon="trash-outline" title="This food was deleted." />
      </Screen>
    );
  }

  async function save(values: SavedFoodValues) {
    if (await runOrAlert("Couldn't save the food", () => tracker.editSavedFood(id, values))) {
      router.back();
    }
  }

  const confirmDelete = async () => {
    const done = await confirmThenRun(
      {
        title: `Delete ${savedFood.name}?`,
        message: 'Meals it was added to keep it as it was logged.',
        decline: 'Cancel',
        accept: 'Delete',
        destructive: true,
      },
      "Couldn't delete the food",
      () => tracker.deleteSavedFood(id),
    );
    if (done) router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: savedFood.name }} />
      <SavedFoodForm initial={savedFood} submitLabel="Save" onSubmit={save} />
      <Button variant="ghost" destructive label="Delete saved food" onPress={confirmDelete} />
    </Screen>
  );
}
