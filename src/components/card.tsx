import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useAppTheme } from '@/theme';

type Props = {
  children: ReactNode;
  // Makes the whole card a button.
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

// A panel that groups related things on the screen.
export function Card({ children, onPress, accessibilityLabel, accessibilityHint, style }: Props) {
  const { colors } = useAppTheme();
  const look = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  if (!onPress) return <View style={[look, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [look, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
});
