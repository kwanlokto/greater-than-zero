import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { restSecondsLeft } from '@/core/tracker';
import { tracker } from '@/database';
import { formatDuration } from '@/durations';
import { runOrAlert } from '@/run-or-alert';
import { space, useAppTheme } from '@/theme';

type Props = {
  workoutId: string;
  restEndsAt: Date | null;
};

// Counts down to the end of the current rest, asking the core for the time
// left on every tick, so it's right after the app has been in the background.
// It sits at the foot of the Workout, with the time large enough to read from
// the floor and the ±15 s buttons under a thumb.
export function RestTimer({ workoutId, restEndsAt }: Props) {
  const { colors } = useAppTheme();
  const now = useNowUntil(restEndsAt);
  if (!restEndsAt) return null;

  const secondsLeft = restSecondsLeft(restEndsAt, new Date(now));
  const move = async (seconds: number) => {
    await runOrAlert("Couldn't move the end of the rest", () =>
      tracker.moveRestEnd(workoutId, seconds),
    );
  };

  if (secondsLeft <= 0) {
    return (
      <View style={styles.over}>
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        <AppText variant="subheading">Rest over</AppText>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Button variant="tonal" label="−15 s" onPress={() => move(-15)} style={styles.move} />
      <View style={styles.reading}>
        <AppText variant="overline" tone="muted">
          Rest
        </AppText>
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Rest ${formatDuration(secondsLeft)}`}
          variant="display"
          // Equal-width digits, so the time doesn't shift as it counts down.
          style={styles.time}
        >
          {formatDuration(secondsLeft)}
        </AppText>
      </View>
      <Button variant="tonal" label="+15 s" onPress={() => move(15)} style={styles.move} />
    </View>
  );
}

// The current time, updated a few times a second until `until` has passed.
function useNowUntil(until: Date | null): number {
  const [now, setNow] = useState(() => Date.now());
  const untilTime = until?.getTime();

  useEffect(() => {
    setNow(Date.now());
    if (untilTime === undefined) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= untilTime) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [untilTime]);

  return now;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  move: {
    minWidth: 84,
    minHeight: 52,
  },
  reading: {
    flex: 1,
    alignItems: 'center',
  },
  time: {
    fontVariant: ['tabular-nums'],
  },
  over: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 40,
  },
});
