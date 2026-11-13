import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import type { DailyTotals, Macro, MacroProgress } from '@/core/tracker';
import { describeEaten, describeLeft, isOver, macroNames } from '@/food-labels';
import { space, useAppTheme } from '@/theme';

type Props = {
  totals: DailyTotals;
  // What pressing it does, in words; without onPress it's not a button.
  hint?: string;
  onPress?: () => void;
};

const gramMacros: Macro[] = ['protein', 'carbs', 'fat'];

// A day's calories and macros, each against its target when one is set: how
// much was eaten, a bar filling towards the target, and what's left or over.
// Calories lead, with what's left beside the bar; protein, carbs and fat sit
// side by side under them.
export function DailyTotalsCard({ totals, hint, onPress }: Props) {
  return (
    <Card onPress={onPress} accessibilityHint={hint} style={styles.card}>
      <View style={styles.row}>
        <AppText variant="bodyStrong">{macroNames.calories}</AppText>
        <AppText variant="bodyStrong">{describeEaten('calories', totals.calories)}</AppText>
      </View>
      {totals.calories.target !== null && (
        <View style={styles.meterRow}>
          <Meter
            progress={totals.calories}
            over={isOver('calories', totals.calories)}
            thick
            style={styles.flex}
          />
          <Left macro="calories" progress={totals.calories} />
        </View>
      )}
      <View style={styles.columns}>
        {gramMacros.map(macro => (
          <View key={macro} style={styles.column}>
            <AppText variant="caption" tone="muted">
              {macroNames[macro]}
            </AppText>
            <AppText variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {describeEaten(macro, totals[macro])}
            </AppText>
            <Meter progress={totals[macro]} over={isOver(macro, totals[macro])} />
            <Left macro={macro} progress={totals[macro]} />
          </View>
        ))}
      </View>
    </Card>
  );
}

type MeterProps = {
  progress: MacroProgress;
  over: boolean;
  thick?: boolean;
  style?: object;
};

// A bar filling towards the target; nothing with no target to fill towards.
// Past the target it turns to the warning colour, track and all.
function Meter({ progress, over, thick = false, style }: MeterProps) {
  const { colors } = useAppTheme();
  // Only a target above 0 to fill towards; one imported below that isn't.
  if (progress.target === null || progress.target <= 0) return null;
  const filled = Math.min(1, progress.eaten / progress.target);

  return (
    <View
      style={[
        styles.track,
        thick && styles.thick,
        { backgroundColor: over ? colors.markOverTrack : colors.markTrack },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          { backgroundColor: over ? colors.markOver : colors.mark, width: `${filled * 100}%` },
        ]}
      />
    </View>
  );
}

// "1699 kcal left", or "9 g over" with a warning mark once past the target.
function Left({ macro, progress }: { macro: Macro; progress: MacroProgress }) {
  const { colors } = useAppTheme();
  const left = describeLeft(macro, progress);
  if (!left) return null;
  const over = isOver(macro, progress);

  return (
    <View style={styles.left}>
      {over && <Ionicons name="alert-circle" size={14} color={colors.danger} />}
      <AppText
        variant="caption"
        tone={over ? 'danger' : 'muted'}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={styles.leftText}
      >
        {left}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    paddingVertical: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  flex: {
    flex: 1,
  },
  columns: {
    flexDirection: 'row',
    gap: space.lg,
    marginTop: space.xs,
  },
  column: {
    flex: 1,
    gap: 3,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  thick: {
    height: 10,
    borderRadius: 5,
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  leftText: {
    flexShrink: 1,
  },
});
