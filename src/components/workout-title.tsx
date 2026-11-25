import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { maxFontScale, space, useAppTheme } from '@/theme';

type Props = {
  workoutId: string;
  title: string;
};

// A Workout's title, in the header of its screen. Tapping it chooses the
// Workout's Category, which is what the title then says.
export function WorkoutTitle({ workoutId, title }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Chooses this workout's category"
      hitSlop={10}
      // navigate, not push, so a double tap opens the chooser once.
      onPress={() => router.navigate({ pathname: '/workout/category', params: { workoutId } })}
      style={({ pressed }) => [styles.title, pressed && styles.pressed]}
    >
      <Text
        maxFontSizeMultiplier={maxFontScale}
        numberOfLines={1}
        style={[styles.text, { color: colors.text }]}
      >
        {title}
      </Text>
      <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexShrink: 1,
  },
  // As the other headers' titles are.
  text: {
    fontSize: 20,
    fontWeight: '700',
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
