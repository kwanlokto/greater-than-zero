import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { database } from '@/database';
import { FinishOnboardingContext, loadOnboardingDone, saveOnboardingDone } from '@/onboarding';
import { useResumeWorkoutOnLaunch } from '@/use-resume-workout-on-launch';
import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
  const migration = useMigrations(database, migrations);
  const [onboarded, setOnboarded] = useState<boolean>();

  useEffect(() => {
    loadOnboardingDone()
      .then(setOnboarded)
      .catch(() => setOnboarded(false));
  }, []);

  const ready = migration.success && onboarded !== undefined;
  const resumeChecked = useResumeWorkoutOnLaunch(ready && onboarded === true);

  // Kept up until any Workout left in progress is on its way back, rather than
  // showing Today first.
  const canHideSplash = migration.error || (ready && (!onboarded || resumeChecked));
  useEffect(() => {
    if (canHideSplash) SplashScreen.hide();
  }, [canHideSplash]);

  async function finishOnboarding() {
    await saveOnboardingDone();
    setOnboarded(true);
  }

  // Nothing reads the database until its migrations have been applied.
  if (migration.error) return <MigrationFailed error={migration.error} theme={theme} />;
  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <FinishOnboardingContext value={finishOnboarding}>
        <Stack>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="exercises/index" options={{ title: 'Exercise library' }} />
            <Stack.Screen name="exercises/new" options={{ title: 'New exercise' }} />
            <Stack.Screen name="exercises/[id]" options={{ title: 'Edit exercise' }} />
            {/* The Workout takes over the screen, covering the tabs. */}
            <Stack.Screen
              name="workout/index"
              options={{ title: 'Workout', presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="workout/add-exercise"
              options={{ title: 'Add exercise', presentation: 'modal' }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </FinishOnboardingContext>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function MigrationFailed({ error, theme }: { error: Error; theme: Theme }) {
  const { colors } = theme;

  return (
    <View style={[styles.error, { backgroundColor: colors.background }]}>
      <Text style={[styles.errorTitle, { color: colors.text }]}>Couldn't open your data</Text>
      <Text style={{ color: colors.text }}>{error.message}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
