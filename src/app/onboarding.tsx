import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { MacroTargetsForm } from '@/components/macro-targets-form';
import { UnitPicker } from '@/components/unit-picker';
import type { MacroTargets, WeightUnit } from '@/core/tracker';
import { tracker } from '@/database';
import { useFinishOnboarding } from '@/onboarding';
import { runOrAlert } from '@/run-or-alert';
import { space, useAppTheme } from '@/theme';

const noTargets: MacroTargets = { calories: null, protein: null, carbs: null, fat: null };

// First launch: the unit the lifter lifts in, then their daily Macro targets,
// which they may skip.
export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const finishOnboarding = useFinishOnboarding();
  const [step, setStep] = useState<'unit' | 'targets'>('unit');

  async function chooseUnit(unit: WeightUnit) {
    if (await runOrAlert("Couldn't save the unit", () => tracker.setDisplayUnit(unit))) {
      setStep('targets');
    }
  }

  async function saveTargets(targets: MacroTargets) {
    if (await runOrAlert("Couldn't save the targets", () => tracker.setMacroTargets(targets))) {
      await finishOnboarding();
    }
  }

  if (step === 'unit') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.centred}>
          <StepCount step={1} />
          <AppText variant="title">Notch</AppText>
          <AppText variant="heading">Which unit do you lift in?</AppText>
          <UnitPicker onChange={chooseUnit} large />
          <AppText tone="muted">You can change this later in Settings.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrolling} keyboardShouldPersistTaps="handled">
        <StepCount step={2} />
        <AppText variant="title">Daily targets</AppText>
        <AppText variant="heading">How much do you aim to eat each day?</AppText>
        <AppText tone="muted">
          Optional: leave any blank, or skip them. You can set them later in Settings.
        </AppText>
        <MacroTargetsForm initial={noTargets} submitLabel="Save targets" onSubmit={saveTargets} />
        <Button variant="ghost" label="Skip for now" onPress={finishOnboarding} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StepCount({ step }: { step: number }) {
  return (
    <AppText variant="overline" tone="primary">
      Step {step} of 2
    </AppText>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    gap: space.lg,
  },
  scrolling: {
    padding: space.xl,
    gap: space.lg,
  },
});
