import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '@/components/button';
import { minTouch, useAppTheme } from '@/theme';
import { useGuardedPress } from '@/use-guarded-press';

type Props = {
  icon: IconName;
  // What it does, for screen readers.
  label: string;
  disabled?: boolean;
  tone?: 'default' | 'muted' | 'primary' | 'danger';
  // A tinted circle behind the icon, for one that should stand out.
  filled?: boolean;
  size?: number;
  onPress: () => void | Promise<unknown>;
  style?: StyleProp<ViewStyle>;
};

// A button that's just an icon, 48 square to the touch.
export function IconButton({
  icon,
  label,
  disabled = false,
  tone = 'default',
  filled = false,
  size = 24,
  onPress,
  style,
}: Props) {
  const { colors } = useAppTheme();
  // A double tap moves a row one place, not two.
  const { press, busy } = useGuardedPress(async () => {
    await onPress();
  });
  const inactive = disabled || busy;
  const color =
    tone === 'primary'
      ? colors.primary
      : tone === 'danger'
        ? colors.danger
        : tone === 'muted'
          ? colors.textMuted
          : colors.text;
  const background = !filled
    ? 'transparent'
    : tone === 'danger'
      ? colors.dangerSoft
      : tone === 'primary'
        ? colors.primarySoft
        : colors.field;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={press}
      android_ripple={{ color: colors.pressed, borderless: true, radius: minTouch / 2 }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.6,
  },
});
