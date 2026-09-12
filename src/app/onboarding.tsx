import { useTheme } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UnitPicker } from '@/components/unit-picker';
import type { WeightUnit } from '@/core/tracker';
import { tracker } from '@/database';
import { useFinishOnboarding } from '@/onboarding';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const finishOnboarding = useFinishOnboarding();

  async function chooseUnit(unit: WeightUnit) {
    await tracker.setDisplayUnit(unit);
    await finishOnboarding();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Greater Than Zero</Text>
      <Text style={[styles.question, { color: colors.text }]}>Which unit do you lift in?</Text>
      <UnitPicker onChange={chooseUnit} />
      <Text style={[styles.hint, { color: colors.text }]}>
        You can change this later in Settings.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  question: {
    fontSize: 18,
  },
  hint: {
    fontSize: 14,
    opacity: 0.7,
  },
});
