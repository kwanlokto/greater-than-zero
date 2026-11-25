import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import type { CategoryChoice } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// Chooses the Category of a Workout, in progress or finished: one there
// already, a new one typed in, or none. A repeat of the Workout stays in it.
export default function ChooseWorkoutCategoryScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  const categories = useTrackerQuery(() => tracker.getCategories(), []);
  // Null once there's no such Workout.
  const workout = useTrackerQuery(
    async () => (await tracker.getWorkout(workoutId)) ?? null,
    [workoutId],
  );
  const [newName, setNewName] = useState('');

  async function choose(choice: CategoryChoice) {
    const chosen = await runOrAlert("Couldn't change the category", () =>
      tracker.setWorkoutCategory(workoutId, choice),
    );
    if (chosen) router.back();
  }

  if (!categories || workout === undefined) return null;

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <AppText tone="muted">
        A category names a kind of workout, such as Push. Repeating this workout keeps it, and a
        rotation puts categories in order.
      </AppText>
      <View style={styles.newCategory}>
        <Input
          value={newName}
          onChangeText={setNewName}
          placeholder="New category"
          accessibilityLabel="New category name"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => newName.trim() && choose({ name: newName })}
          style={styles.name}
        />
        <Button
          label="Add"
          icon="add"
          disabled={!newName.trim()}
          // Guarded by the button: a double tap adds it once.
          onPress={() => choose({ name: newName })}
        />
      </View>
      <ListGroup>
        {categories.map(category => (
          <ListRow
            key={category.id}
            title={category.name}
            trailingIcon={
              workout?.categoryId === category.id ? 'radio-button-on' : 'radio-button-off'
            }
            trailingIconTone={workout?.categoryId === category.id ? 'primary' : 'muted'}
            accessibilityHint="Puts this workout in this category"
            onPress={() => choose({ id: category.id })}
          />
        ))}
        <ListRow
          title="No category"
          trailingIcon={workout?.categoryId === null ? 'radio-button-on' : 'radio-button-off'}
          trailingIconTone={workout?.categoryId === null ? 'primary' : 'muted'}
          onPress={() => choose(null)}
        />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  newCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    flex: 1,
  },
});
