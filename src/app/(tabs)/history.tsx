import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { MonthCalendar } from '@/components/month-calendar';
import { Screen } from '@/components/screen';
import { monthOf } from '@/core/tracker';
import { tracker } from '@/database';
import { space } from '@/theme';
import { useToday } from '@/use-today';
import { useTrackerQuery } from '@/use-tracker-query';

// A calendar of the days trained, opening on this month. Tapping a day opens
// what was recorded on it.
export default function HistoryScreen() {
  const router = useRouter();
  const today = useToday();
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const trainingDays = useTrackerQuery(() => tracker.getTrainingDays(month), [month]);

  return (
    <Screen onTab contentStyle={{ gap: space.md }}>
      <MonthCalendar
        month={month}
        trainingDays={trainingDays ?? []}
        today={today}
        onChangeMonth={setMonth}
        // navigate, not push, so a double tap can't open the day twice.
        onPressDay={date => router.navigate({ pathname: '/day/[date]', params: { date } })}
      />
      <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
        Tap a day to see its workouts, meals and weigh-in.
      </AppText>
      {/* The way back after browsing other months. */}
      {month !== thisMonth && (
        <Button
          variant="tonal"
          icon="today-outline"
          label="Back to this month"
          onPress={() => setMonth(thisMonth)}
          style={{ alignSelf: 'center' }}
        />
      )}
    </Screen>
  );
}
