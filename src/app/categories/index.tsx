import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import type { Category } from '@/core/tracker';
import { tracker } from '@/database';
import { confirmThenRun, runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// Every Category, to rename or delete. They're made where they're used: by
// naming a Workout.
export default function CategoriesScreen() {
  const categories = useTrackerQuery(() => tracker.getCategories(), []);

  return (
    <Screen contentStyle={{ gap: space.md }}>
      {categories?.length === 0 && (
        <EmptyState
          icon="pricetag-outline"
          title="No categories yet"
          message="Give a workout a category, such as Push, by tapping its title. Repeating it keeps the category, and a rotation puts categories in order."
        />
      )}
      {categories && categories.length > 0 && (
        <AppText tone="muted">
          {"Renaming a category renames it on every workout in it. A new name is saved when you're done typing."}
        </AppText>
      )}
      {categories?.map(category => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </Screen>
  );
}

// One Category: its name, to change, and a button to delete it.
function CategoryCard({ category }: { category: Category }) {
  const [name, setName] = useState(category.name);

  // A name that's refused, blank or another Category's, is put back.
  async function rename() {
    if (name === category.name) return;
    const renamed = await runOrAlert("Couldn't rename the category", () =>
      tracker.renameCategory(category.id, name),
    );
    if (!renamed) setName(category.name);
  }

  const confirmDelete = () =>
    confirmThenRun(
      {
        title: `Delete ${category.name}?`,
        message: 'Its workouts stay in History, without a category. It leaves any rotation.',
        decline: 'Cancel',
        accept: 'Delete',
        destructive: true,
      },
      "Couldn't delete the category",
      () => tracker.deleteCategory(category.id),
    );

  return (
    <Card style={styles.category}>
      <Input
        value={name}
        onChangeText={setName}
        onEndEditing={rename}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel={`Name of ${category.name}`}
        strong
        style={styles.name}
      />
      <IconButton
        icon="trash-outline"
        label={`Delete ${category.name}`}
        tone="danger"
        onPress={confirmDelete}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    flex: 1,
  },
});
