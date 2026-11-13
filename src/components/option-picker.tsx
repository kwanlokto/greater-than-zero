import { Pressable, StyleSheet, Text, View } from 'react-native';

import { maxFontScale, minTouch, radius, space, useAppTheme } from '@/theme';

type Props<T extends string> = {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onChange: (value: T) => void;
  // Taller, for when the choice is the point of the screen.
  large?: boolean;
};

// A row of equal-width choices, one of them selected, for a handful of options.
export function OptionPicker<T extends string>({
  options,
  labels,
  value,
  onChange,
  large = false,
}: Props<T>) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, { backgroundColor: colors.field, borderColor: colors.border }]}
    >
      {options.map(option => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option)}
            android_ripple={{ color: colors.pressed }}
            style={({ pressed }) => [
              styles.option,
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
    flex: 1,
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
  label: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
