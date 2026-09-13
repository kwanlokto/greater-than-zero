import { useTheme } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
};

// Ignores further taps until the press's work is done, so a double tap can't
// run it twice.
export function PrimaryButton({ label, onPress, disabled = false }: Props) {
  const { colors } = useTheme();
  const busy = useRef(false);
  const [showBusy, setShowBusy] = useState(false);
  const inactive = disabled || showBusy;

  async function press() {
    if (busy.current) return;
    busy.current = true;
    setShowBusy(true);
    try {
      await onPress();
    } finally {
      busy.current = false;
      setShowBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={press}
      style={[styles.button, { backgroundColor: colors.primary, opacity: inactive ? 0.4 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
