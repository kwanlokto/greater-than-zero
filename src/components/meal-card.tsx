import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { IconName } from '@/components/button';
import { Card } from '@/components/card';
import { MacroSummary } from '@/components/macro-summary';
import type { Meal } from '@/core/tracker';
import { formatTimeOfDay } from '@/dates';
import { describeFoodItem, formatCalories } from '@/food-labels';
import { radius, space, useAppTheme } from '@/theme';

type Props = {
  meal: Meal;
  // What pressing it does, in words, and as a labelled badge for anything
  // other than opening it; opening it for editing unless said otherwise.
  hint?: string;
  action?: { label: string; icon: IconName };
  onPress: () => void;
};

// A Meal: its name and time, its totals, then each Food item with its amount
// and calories.
export function MealCard({ meal, hint = 'Opens this meal for editing', action, onPress }: Props) {
  const { colors } = useAppTheme();

  return (
    <Card onPress={onPress} accessibilityHint={hint} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <AppText variant="subheading">{meal.name}</AppText>
          <AppText variant="caption" tone="muted">
            {formatTimeOfDay(meal.eatenAt)}
          </AppText>
        </View>
        {action ? (
          <View style={[styles.action, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={action.icon} size={16} color={colors.onPrimarySoft} />
            <AppText variant="label" style={{ color: colors.onPrimarySoft }}>
              {action.label}
            </AppText>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        )}
      </View>
      <MacroSummary macros={meal.totals} />
      {meal.items.length > 0 && (
        <View style={[styles.items, { borderTopColor: colors.border }]}>
          {meal.items.map(item => (
            <View key={item.id} style={styles.item}>
              <AppText numberOfLines={1} style={styles.itemName}>
                {describeFoodItem(item)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {formatCalories(item.calories)} kcal
              </AppText>
            </View>
          ))}
        </View>
      )}
      {meal.items.length === 0 && (
        <AppText variant="caption" tone="muted">
          No food yet
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
    flex: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  items: {
    gap: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  itemName: {
    flex: 1,
  },
});
