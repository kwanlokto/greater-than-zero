import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useGuardedPress } from '@/use-guarded-press';

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  // Shown in the theme's warning colour, for actions like deleting.
  destructive?: boolean;
};

// A lighter-weight button: just its label, in the theme's accent colour.
export function TextButton({ label, onPress, destructive = false }: Props) {
  const { colors } = useTheme();
  const { press, busy } = useGuardedPress(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      hitSlop={8}
      onPress={press}
      style={styles.button}
    >
      <Text style={[styles.label, { color: destructive ? colors.notification : colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
