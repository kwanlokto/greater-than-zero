import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useRouter, useTheme } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { tracker } from '@/database';
import { describeMacros, describeServing } from '@/food-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// Every Saved food by name, each with its Serving and macros; tapping one
// opens it for editing.
export default function SavedFoodsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const savedFoods = useTrackerQuery(() => tracker.getSavedFoods(), []);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <NewSavedFoodButton /> }} />
      <FlatList
        data={savedFoods ?? []}
        keyExtractor={food => food.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.navigate({ pathname: '/saved-foods/[id]', params: { id: item.id } })
            }
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.details, { color: colors.text }]}>
                {describeServing(item)} · {describeMacros(item)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        )}
        ListEmptyComponent={
          savedFoods && (
            <Text style={[styles.empty, { color: colors.text }]}>
              No saved foods yet. Tap + to save one you eat often.
            </Text>
          )
        }
      />
    </>
  );
}

function NewSavedFoodButton() {
  const { colors } = useTheme();

  return (
    <Link href="/saved-foods/new" asChild>
      <Pressable accessibilityLabel="New saved food" hitSlop={12} style={styles.addButton}>
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  addButton: {
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  details: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
