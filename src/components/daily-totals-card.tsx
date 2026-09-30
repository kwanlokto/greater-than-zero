import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DailyTotals } from '@/core/tracker';
import { describeEaten, describeLeft, isOver, macroNames, macros } from '@/food-labels';

type Props = {
  totals: DailyTotals;
  // What pressing it does, in words.
  hint: string;
  onPress: () => void;
};

// A day's calories and macros, each against its target when one is set: how
// much was eaten, a bar filling towards the target, and what's left or over.
export function DailyTotalsCard({ totals, hint, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {macros.map(macro => {
        const progress = totals[macro];
        const left = describeLeft(macro, progress);
        const over = isOver(macro, progress);
        // Only a target above 0 to fill towards; one imported below that isn't.
        const filled =
          progress.target !== null && progress.target > 0
            ? Math.min(1, progress.eaten / progress.target)
            : undefined;
        return (
          <View key={macro} style={styles.macro}>
            <View style={styles.row}>
              <Text style={[styles.name, { color: colors.text }]}>{macroNames[macro]}</Text>
              <Text style={[styles.eaten, { color: colors.text }]}>
                {describeEaten(macro, progress)}
              </Text>
            </View>
            {filled !== undefined && (
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: over ? colors.notification : colors.primary,
                      width: `${filled * 100}%`,
                    },
                  ]}
                />
              </View>
            )}
            {left && (
              <Text style={[styles.left, { color: over ? colors.notification : colors.text }]}>
                {left}
              </Text>
            )}
          </View>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  macro: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  eaten: {
    fontSize: 16,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  left: {
    fontSize: 13,
    opacity: 0.7,
  },
});
