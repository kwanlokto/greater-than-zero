import { useTheme } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/text-button';
import { restSecondsLeft } from '@/core/tracker';
import { tracker } from '@/database';
import { formatDuration } from '@/durations';
import { runOrAlert } from '@/run-or-alert';

type Props = {
  workoutId: string;
  restEndsAt: Date | null;
};

// Counts down to the end of the current rest, asking the core for the time
// left on every tick, so it's right after the app has been in the background.
export function RestTimer({ workoutId, restEndsAt }: Props) {
  const { colors } = useTheme();
  const now = useNowUntil(restEndsAt);
  if (!restEndsAt) return null;

  const secondsLeft = restSecondsLeft(restEndsAt, new Date(now));
  const move = async (seconds: number) => {
    await runOrAlert("Couldn't move the end of the rest", () =>
      tracker.moveRestEnd(workoutId, seconds),
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {secondsLeft > 0 ? (
        <>
          <TextButton label="−15 s" onPress={() => move(-15)} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.time, { color: colors.text }]}
          >
            Rest {formatDuration(secondsLeft)}
          </Text>
          <TextButton label="+15 s" onPress={() => move(15)} />
        </>
      ) : (
        <Text style={[styles.over, { color: colors.text }]}>Rest over</Text>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  time: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  over: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
});
