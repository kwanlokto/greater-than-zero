import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { ListGroup, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { canAddToRotation } from '@/core/tracker';
import { tracker } from '@/database';
import { describeCategoryOrder } from '@/rotation-labels';
import { runOrAlert } from '@/run-or-alert';
import { space } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks Categories to add to the end of a Rotation, in the order they're
// tapped: ones it can still take, or new ones by name, so a split can be laid
// out before any of it is trained. It stays open until Done, so a whole split
// is one visit.
export default function ChooseRotationCategoryScreen() {
  const { rotationId } = useLocalSearchParams<{ rotationId: string }>();
  const router = useRouter();
  // The Rotation as it stands, and the Categories it can still take. Each one
  // added leaves the list.
  const categories = useTrackerQuery(async () => {
    const [all, rotation] = await Promise.all([
      tracker.getCategories(),
      tracker.getRotation(rotationId),
    ]);
    return {
      added: rotation && rotation.entries.length > 0 ? describeCategoryOrder(rotation) : undefined,
      addable: rotation ? all.filter(({ id }) => canAddToRotation(rotation, id)) : [],
    };
  }, [rotationId]);
  const [newName, setNewName] = useState('');

  async function add(choice: { id: string } | { name: string }) {
    const added = await runOrAlert("Couldn't add the category", () =>
      tracker.addCategoryToRotation(rotationId, choice),
    );
    // Ready for the next name.
    if (added && 'name' in choice) setNewName('');
  }

  if (!categories) return null;
  const { added, addable } = categories;

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button variant="ghost" size="small" label="Done" onPress={() => router.back()} />
          ),
        }}
      />
      {/* What's in it so far, so each tap is seen to land, in order. */}
      {added && <AppText variant="bodyStrong">{added}</AppText>}
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
              // Guarded by the row, and by the core: a double tap adds it once.
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
