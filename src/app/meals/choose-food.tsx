import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, useTheme } from 'expo-router';
import type { ComponentProps } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { tracker } from '@/database';
import { describeMacros, describeServing } from '@/food-labels';
import { useTrackerQuery } from '@/use-tracker-query';

// Picks what to add to a Meal: a one-off Food item typed in, or a Saved food
// in a quantity, including one saved from here first.
export default function ChooseFoodScreen() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const savedFoods = useTrackerQuery(() => tracker.getSavedFoodsByRecentUse(), []);

  return (
    <FlatList
      data={savedFoods ?? []}
      keyExtractor={food => food.id}
      ListHeaderComponent={
        <>
          <ChoiceRow
            icon="create-outline"
            label="One-off food"
            details="Type in its macros, without saving it"
            onPress={() => router.replace({ pathname: '/meals/food-item', params: { mealId } })}
          />
          <ChoiceRow
            icon="add-circle-outline"
            label="New saved food"
            details="Save a food you eat often, then add it"
            onPress={() => router.replace({ pathname: '/saved-foods/new', params: { mealId } })}
          />
          <Text style={[styles.heading, { color: colors.text }]}>
            Saved foods, most recently used first
          </Text>
        </>
      }
      renderItem={({ item }) => (
        <ChoiceRow
          label={item.name}
          details={`${describeServing(item)} · ${describeMacros(item)}`}
          onPress={() =>
            router.replace({
              pathname: '/meals/portion',
              params: { mealId, savedFoodId: item.id },
            })
          }
        />
      )}
      ListEmptyComponent={
        savedFoods && (
          <Text style={[styles.empty, { color: colors.text }]}>No saved foods yet.</Text>
        )
      }
    />
  );
}

type ChoiceRowProps = {
  icon?: ComponentProps<typeof Ionicons>['name'];
  label: string;
  details: string;
  onPress: () => void;
};

function ChoiceRow({ icon, label, details, onPress }: ChoiceRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      {icon && <Ionicons name={icon} size={22} color={colors.primary} />}
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.details, { color: colors.text }]}>{details}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  heading: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
