import { Pressable, StyleSheet, Text } from 'react-native';

import { maxFontScale, radius, space, useAppTheme } from '@/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

// A small choice that's on or off, such as a filter. 40 high, 48 to the touch.
export function Chip({ label, selected, onPress }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        maxFontSizeMultiplier={maxFontScale}
        style={[styles.label, { color: selected ? colors.onPrimary : colors.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
