import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useRouter, useTheme } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { tracker } from '@/database';
import { exerciseCount } from '@/template-labels';
import { useTrackerQuery } from '@/use-tracker-query';

export default function TemplatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const templates = useTrackerQuery(() => tracker.getTemplates(), []);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <NewTemplateButton /> }} />
      <FlatList
        data={templates ?? []}
        keyExtractor={template => template.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/templates/[id]', params: { id: item.id } })}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.details, { color: colors.text }]}>
                {exerciseCount(item.exercises.length)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        )}
        ListEmptyComponent={
          templates && (
            <Text style={[styles.empty, { color: colors.text }]}>
              No templates yet. Tap + to create one.
            </Text>
          )
        }
      />
    </>
  );
}

function NewTemplateButton() {
  const { colors } = useTheme();

  return (
    <Link href="/templates/new" asChild>
      <Pressable accessibilityLabel="New template" hitSlop={12} style={styles.addButton}>
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
