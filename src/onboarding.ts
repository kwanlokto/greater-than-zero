import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use } from 'react';

// Device-local UI state, so it lives in AsyncStorage rather than the database.
const onboardingDoneKey = 'onboardingDone';

export async function loadOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(onboardingDoneKey)) === 'true';
}

export async function saveOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(onboardingDoneKey, 'true');
}

// Provided by the root layout, which swaps the onboarding screen for the tabs.
export const FinishOnboardingContext = createContext<() => Promise<void>>(async () => {});

export function useFinishOnboarding() {
  return use(FinishOnboardingContext);
}
