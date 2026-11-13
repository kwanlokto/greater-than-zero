import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { Macros } from '@/core/tracker';
import { formatCalories, formatGrams } from '@/food-labels';
import { space } from '@/theme';

type Props = {
  macros: Macros;
  // Larger numbers, for a screen's own totals rather than a card's.
  large?: boolean;
};

// Calories and grams of each macro side by side: each number over its name.
export function MacroSummary({ macros, large = false }: Props) {
  const { calories, protein, carbs, fat } = macros;
  const columns = [
    { value: formatCalories(calories), unit: '', name: 'kcal' },
    { value: formatGrams(protein), unit: ' g', name: 'Protein' },
    { value: formatGrams(carbs), unit: ' g', name: 'Carbs' },
    { value: formatGrams(fat), unit: ' g', name: 'Fat' },
  ];

  return (
    <View
      accessible
      accessibilityLabel={
        `${formatCalories(calories)} calories, ${formatGrams(protein)} grams of protein, ` +
        `${formatGrams(carbs)} grams of carbs, ${formatGrams(fat)} grams of fat`
      }
      style={styles.row}
    >
      {columns.map(column => (
        <View key={column.name} style={styles.column}>
          <AppText
            variant={large ? 'heading' : 'bodyStrong'}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {column.value}
            <AppText variant="caption" tone="muted">
              {column.unit}
            </AppText>
          </AppText>
          <AppText variant="caption" tone="muted">
            {column.name}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  column: {
    flex: 1,
  },
});
