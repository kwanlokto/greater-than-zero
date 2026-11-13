import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maxFontScale, space, useAppTheme } from '@/theme';
import { useGuardedPress } from '@/use-guarded-press';

type Props = {
  label: string;
  // On a tab, the tab bar already keeps it clear of the system bar.
  onTab?: boolean;
  onPress: () => void | Promise<void>;
};

// How much room to leave under a list so its last row clears the button.
export const fabClearance = 80;

// The screen's "add" action, floating over the bottom corner where a thumb
// reaches it.
export function Fab({ label, onTab = false, onPress }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { press, busy } = useGuardedPress(onPress);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={press}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          bottom: space.lg + (onTab ? 0 : insets.bottom),
          shadowColor: '#000000',
        },
        (pressed || busy) && styles.pressed,
      ]}
    >
      <Ionicons name="add" size={24} color={colors.onPrimary} />
      <Text
        maxFontSizeMultiplier={maxFontScale}
        style={[styles.label, { color: colors.onPrimary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingLeft: space.lg,
    paddingRight: space.xl,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
