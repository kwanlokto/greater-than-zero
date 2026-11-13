import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { maxFontScale, radius, space, useAppTheme } from '@/theme';
import { useWorkoutInProgress } from '@/use-workout-in-progress';
import { backfillTitle } from '@/workout-labels';

// Shown on every tab while a Workout is in progress; tapping it returns there.
export function WorkoutBar() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const workout = useWorkoutInProgress();

  if (!workout) return null;

  const setCount = workout.entries.reduce((count, entry) => count + entry.sets.length, 0);

  return (
    <View style={styles.frame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to workout in progress"
        // navigate, not push, so a double tap can't open the Workout twice.
        onPress={() => router.navigate('/workout')}
        android_ripple={{ color: colors.pressed }}
        style={({ pressed }) => [
          styles.bar,
          { backgroundColor: colors.primary },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="barbell" size={24} color={colors.onPrimary} />
        <View style={styles.text}>
          <Text
            maxFontSizeMultiplier={maxFontScale}
            numberOfLines={1}
            style={[styles.title, { color: colors.onPrimary }]}
          >
            {backfillTitle(workout) ?? 'Workout in progress'}
          </Text>
          <Text
            maxFontSizeMultiplier={maxFontScale}
            style={[styles.detail, { color: colors.onPrimary }]}
          >
            {setCount === 1 ? '1 set logged' : `${setCount} sets logged`}
          </Text>
        </View>
        <Ionicons name="chevron-up" size={24} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  detail: {
    fontSize: 13,
    opacity: 0.9,
  },
});
