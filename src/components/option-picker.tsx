import { Pressable, StyleSheet, Text, View } from 'react-native';

import { maxFontScale, minTouch, radius, space, useAppTheme } from '@/theme';

type Props<T extends string> = {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onChange: (value: T) => void;
  // What a screen reader says for each choice, when the labels are short.
  accessibilityLabels?: Record<T, string>;
  // What the choice is about, for a screen reader.
  accessibilityLabel?: string;
  // Taller, for when the choice is the point of the screen.
  large?: boolean;
  // Only as wide as its labels and drawn 32 high, to sit at the end of a list
  // row; still touched like 48.
  compact?: boolean;
};

// A row of equal-width choices, one of them selected, for a handful of options.
export function OptionPicker<T extends string>({
  options,
  labels,
  accessibilityLabels,
  accessibilityLabel,
  value,
  onChange,
  large = false,
  compact = false,
}: Props<T>) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.field, borderColor: colors.border }]}
    >
      {options.map(option => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={accessibilityLabels?.[option]}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option)}
            hitSlop={compact ? { top: 8, bottom: 8 } : undefined}
            android_ripple={{ color: colors.pressed }}
            style={({ pressed }) => [
              styles.option,
              compact ? styles.compact : styles.fill,
              large && styles.large,
              { backgroundColor: selected ? colors.primary : 'transparent' },
              pressed && styles.pressed,
            ]}
          >
            <Text
              maxFontSizeMultiplier={maxFontScale}
              style={[styles.label, { color: selected ? colors.onPrimary : colors.text }]}
            >
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md + space.xs,
  },
  option: {
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  large: {
    minHeight: 64,
  },
  fill: {
    flex: 1,
  },
  compact: {
    minHeight: 32,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
