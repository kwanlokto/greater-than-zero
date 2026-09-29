import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useGuardedPress } from '@/use-guarded-press';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  disabled?: boolean;
  onPress: () => void | Promise<unknown>;
};

// A small icon button for a row, such as moving or removing it.
export function IconButton({ icon, label, disabled = false, onPress }: Props) {
  const { colors } = useTheme();
  // A double tap moves a row one place, not two.
  const { press, busy } = useGuardedPress(async () => {
    await onPress();
  });
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      hitSlop={6}
      onPress={press}
      style={[styles.button, { opacity: inactive ? 0.3 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 6,
  },
});
