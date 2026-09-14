import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { MonthCalendar } from '@/components/month-calendar';
import { localDateOf } from '@/core/tracker';
import { tracker } from '@/database';
import { monthOf } from '@/dates';
import { useTrackerQuery } from '@/use-tracker-query';

// A calendar of the days trained, opening on this month. Tapping a day opens
// what was recorded on it.
export default function HistoryScreen() {
  const router = useRouter();
  const today = localDateOf(new Date());
  const [month, setMonth] = useState(() => monthOf(today));
  const trainingDays = useTrackerQuery(() => tracker.getTrainingDays(month), [month]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MonthCalendar
        month={month}
        trainingDays={trainingDays ?? []}
        today={today}
        onChangeMonth={setMonth}
        // navigate, not push, so a double tap can't open the day twice.
        onPressDay={date => router.navigate({ pathname: '/day/[date]', params: { date } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
