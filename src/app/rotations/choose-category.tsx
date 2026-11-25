import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { canAddToRotation } from '@/core/tracker';
import { tracker } from '@/database';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks a Category to add to the end of a Rotation: one it can still take, or
// a new one by name, so a split can be laid out before any of it is trained.
export default function ChooseRotationCategoryScreen() {
  const { rotationId } = useLocalSearchParams<{ rotationId: string }>();
  const router = useRouter();
  const addable = useTrackerQuery(async () => {
    const [all, rotation] = await Promise.all([
      tracker.getCategories(),
      tracker.getRotation(rotationId),
    ]);
    return rotation ? all.filter(({ id }) => canAddToRotation(rotation, id)) : [];
  }, [rotationId]);
  const [newName, setNewName] = useState('');

  async function add(choice: { id: string } | { name: string }) {
    const added = await runOrAlert("Couldn't add the category", () =>
      tracker.addCategoryToRotation(rotationId, choice),
    );
    if (added) router.back();
  }

  if (!addable) return null;

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <View style={styles.newCategory}>
        <Input
          value={newName}
          onChangeText={setNewName}
          placeholder="New category, e.g. Push"
          accessibilityLabel="New category name"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => newName.trim() && add({ name: newName })}
          style={styles.name}
        />
        <Button
          label="Add"
          icon="add"
          disabled={!newName.trim()}
          // Guarded by the button: a double tap adds it once.
          onPress={() => add({ name: newName })}
        />
      </View>
      {addable.length > 0 ? (
        <ListGroup>
          {addable.map(category => (
            <ListRow
              key={category.id}
              title={category.name}
              accessibilityLabel={`Add ${category.name}`}
              trailingIcon="add-circle"
              trailingIconTone="primary"
              // Guarded by the row: a double tap adds it once.
              onPress={() => add({ id: category.id })}
            />
          ))}
        </ListGroup>
      ) : (
        <AppText tone="muted">
          Every category you have is in this rotation. Type a name to add a new one: starting it
          from Today begins an empty workout in it.
        </AppText>
      )}
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
