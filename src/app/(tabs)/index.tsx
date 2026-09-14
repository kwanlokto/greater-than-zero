import { useRouter, useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { tracker } from '@/database';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const workoutInProgress = useWorkoutInProgress();

  async function startEmptyWorkout() {
    await tracker.startWorkout();
    router.push('/workout');
  }

  return (
    <View style={styles.container}>
      {/* Only one Workout can be in progress; while one is, the Workout bar
          returns to it. */}
      {workoutInProgress === null && (
        <PrimaryButton label="Start empty workout" onPress={startEmptyWorkout} />
      )}
      <Text style={[styles.placeholder, { color: colors.text }]}>
        Your next-up workout, today's food and today's weigh-in will show here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
    justifyContent: 'center',
  },
  placeholder: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
