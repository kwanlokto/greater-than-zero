import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tracker } from '@/database';
import { useTrackerQuery } from '@/use-tracker-query';

// Shown on every tab while a Workout is in progress; tapping it returns there.
export function WorkoutBar() {
  const router = useRouter();
  const { colors } = useTheme();
  const workout = useTrackerQuery(() => tracker.getWorkoutInProgress(), []);

  if (!workout) return null;

  const setCount = workout.entries.reduce((count, entry) => count + entry.sets.length, 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Return to workout in progress"
      // navigate, not push, so a double tap can't open the Workout twice.
      onPress={() => router.navigate('/workout')}
      style={[styles.bar, { backgroundColor: colors.primary }]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>Workout in progress</Text>
        <Text style={styles.detail}>
          {setCount === 1 ? '1 set logged' : `${setCount} sets logged`}
        </Text>
      </View>
      <Ionicons name="chevron-up" size={22} color="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.85,
  },
});
