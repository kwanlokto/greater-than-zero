import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { maxFontScale, minTouch, radius, space, useAppTheme, type Palette } from '@/theme';
import { useGuardedPress } from '@/use-guarded-press';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost';
type Size = 'large' | 'medium' | 'small';

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  // primary: the screen's main action. secondary: an outlined alternative.
  // tonal: a quieter filled button. ghost: just its label.
  variant?: Variant;
  // In the warning colour, for actions like deleting.
  destructive?: boolean;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  // Extra touch area on every side, for one drawn smaller than 48 high.
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

function coloursFor(colors: Palette, variant: Variant, destructive: boolean) {
  switch (variant) {
    case 'primary':
      return destructive
        ? { background: colors.danger, text: colors.onDanger, border: colors.danger }
        : { background: colors.primary, text: colors.onPrimary, border: colors.primary };
    case 'tonal':
      return destructive
        ? { background: colors.dangerSoft, text: colors.onDangerSoft, border: colors.dangerSoft }
        : {
            background: colors.primarySoft,
            text: colors.onPrimarySoft,
            border: colors.primarySoft,
          };
    case 'secondary':
      return {
        background: colors.surface,
        text: destructive ? colors.danger : colors.text,
        border: colors.border,
      };
    case 'ghost':
      return {
        background: 'transparent',
        text: destructive ? colors.danger : colors.primary,
        border: 'transparent',
      };
  }
}

// The app's button. Every size is at least 48 high to the touch, and a second
// tap while its work is still running is ignored.
export function Button({
  label,
  onPress,
  variant = 'primary',
  destructive = false,
  size = 'medium',
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  hitSlop,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const { press, busy } = useGuardedPress(onPress);
  const inactive = disabled || busy;
  const tint = coloursFor(colors, variant, destructive);
  const shape = sizes[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      // The small size is 40 high; this brings its touch area up to 48.
      hitSlop={hitSlop ?? (size === 'small' ? { top: 4, bottom: 4 } : undefined)}
      onPress={press}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.button,
        shape.button,
        { backgroundColor: tint.background, borderColor: tint.border },
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={shape.icon} color={tint.text} />}
      <Text
        maxFontSizeMultiplier={maxFontScale}
        numberOfLines={1}
        style={[styles.label, shape.label, { color: tint.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  label: {
    fontWeight: '600',
    flexShrink: 1,
  },
  inactive: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});

const sizes: Record<Size, { button: ViewStyle; label: TextStyle; icon: number }> = {
  large: {
    button: { minHeight: 56, paddingHorizontal: space.xl, borderRadius: radius.lg },
    label: { fontSize: 17 },
    icon: 22,
  },
  medium: {
    button: { minHeight: minTouch, paddingHorizontal: space.lg, borderRadius: radius.md },
    label: { fontSize: 16 },
    icon: 20,
  },
  small: {
    button: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.sm },
    label: { fontSize: 14 },
    icon: 18,
  },
};
