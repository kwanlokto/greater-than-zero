import { useTheme } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MacroTargetsForm } from '@/components/macro-targets-form';
import { TextButton } from '@/components/text-button';
import { UnitPicker } from '@/components/unit-picker';
import type { MacroTargets, WeightUnit } from '@/core/tracker';
import { tracker } from '@/database';
import { useFinishOnboarding } from '@/onboarding';
import { runOrAlert } from '@/run-or-alert';

const noTargets: MacroTargets = { calories: null, protein: null, carbs: null, fat: null };

// First launch: the unit the lifter lifts in, then their daily Macro targets,
// which they may skip.
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const finishOnboarding = useFinishOnboarding();
  const [step, setStep] = useState<'unit' | 'targets'>('unit');

  async function chooseUnit(unit: WeightUnit) {
    await tracker.setDisplayUnit(unit);
    setStep('targets');
  }

  async function saveTargets(targets: MacroTargets) {
    if (await runOrAlert("Couldn't save the targets", () => tracker.setMacroTargets(targets))) {
      await finishOnboarding();
    }
  }

  if (step === 'unit') {
    return (
      <SafeAreaView style={styles.centred}>
        <Text style={[styles.title, { color: colors.text }]}>Greater Than Zero</Text>
        <Text style={[styles.question, { color: colors.text }]}>Which unit do you lift in?</Text>
        <UnitPicker onChange={chooseUnit} />
        <Text style={[styles.hint, { color: colors.text }]}>
          You can change this later in Settings.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrolling} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Daily targets</Text>
        <Text style={[styles.question, { color: colors.text }]}>
          How much do you aim to eat each day?
        </Text>
        <Text style={[styles.hint, { color: colors.text }]}>
          Optional: leave any blank, or skip them. You can set them later in Settings.
        </Text>
        <MacroTargetsForm initial={noTargets} submitLabel="Save targets" onSubmit={saveTargets} />
        <TextButton label="Skip for now" onPress={finishOnboarding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centred: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  screen: {
    flex: 1,
  },
  scrolling: {
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
