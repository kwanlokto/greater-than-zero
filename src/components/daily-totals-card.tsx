import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DailyTotals, Macros } from '@/core/tracker';
import { describeEaten, describeLeft, macroNames } from '@/food-labels';

type Props = {
  totals: DailyTotals;
  onPress: () => void;
};

const macros = Object.keys(macroNames) as (keyof Macros)[];

// A day's calories and macros, each against its target when one is set: how
// much was eaten, a bar filling towards the target, and what's left or over.
export function DailyTotalsCard({ totals, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens today's meals"
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {macros.map(macro => {
        const progress = totals[macro];
        const left = describeLeft(macro, progress);
        const over = progress.left !== null && progress.left < 0;
        return (
          <View key={macro} style={styles.macro}>
            <View style={styles.row}>
              <Text style={[styles.name, { color: colors.text }]}>{macroNames[macro]}</Text>
              <Text style={[styles.eaten, { color: colors.text }]}>
                {describeEaten(macro, progress)}
              </Text>
            </View>
            {progress.target !== null && (
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: over ? colors.notification : colors.primary,
                      width: `${Math.min(100, (progress.eaten / progress.target) * 100)}%`,
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
