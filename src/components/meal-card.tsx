import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Meal } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';
import { describeFoodItem, describeMacros, formatCalories } from '@/food-labels';

type Props = {
  meal: Meal;
  onPress: () => void;
};

// A Meal: its name and time, its totals, then each Food item with its amount
// and calories. Pressing it opens it for editing.
export function MealCard({ meal, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this meal for editing"
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]}>{meal.name}</Text>
        <Text style={[styles.detail, styles.faint, { color: colors.text }]}>
          {formatTimeOfDay(meal.eatenAt)}
        </Text>
        <Ionicons name="create-outline" size={18} color={colors.text} style={styles.faint} />
      </View>
      <Text style={[styles.totals, { color: colors.text }]}>{describeMacros(meal.totals)}</Text>
      {meal.items.length === 0 && (
        <Text style={[styles.detail, styles.faint, { color: colors.text }]}>No food yet</Text>
      )}
      {meal.items.map(item => (
        <View key={item.id} style={styles.item}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {describeFoodItem(item)}
          </Text>
          <Text style={[styles.detail, styles.faint, { color: colors.text }]}>
            {formatCalories(item.calories)} kcal
          </Text>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  totals: {
    fontSize: 14,
  },
  item: {
    flexDirection: 'row',
    gap: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
  },
  detail: {
    fontSize: 14,
  },
  faint: {
    opacity: 0.7,
  },
});
