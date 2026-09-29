import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useRouter, useTheme } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { tracker } from '@/database';
import { describeTemplateOrder } from '@/rotation-labels';
import { useTrackerQuery } from '@/use-tracker-query';

export default function RotationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const rotations = useTrackerQuery(() => tracker.getRotations(), []);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <NewRotationButton /> }} />
      <FlatList
        data={rotations ?? []}
        keyExtractor={rotation => rotation.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/rotations/[id]', params: { id: item.id } })}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.details, { color: colors.text }]}>
                {describeTemplateOrder(item)}
              </Text>
            </View>
            {item.isActive && (
              <Text style={[styles.active, { color: colors.primary }]}>Active</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        )}
        ListEmptyComponent={
          rotations && (
            <Text style={[styles.empty, { color: colors.text }]}>
              No rotations yet. Tap + to create one, e.g. Push → Pull → Legs.
            </Text>
          )
        }
      />
    </>
  );
}

function NewRotationButton() {
  const { colors } = useTheme();

  return (
    <Link href="/rotations/new" asChild>
      <Pressable accessibilityLabel="New rotation" hitSlop={12} style={styles.addButton}>
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
    gap: 8,
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
  active: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
