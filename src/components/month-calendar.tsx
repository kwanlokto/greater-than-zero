import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  calendarWeeks,
  dayOfMonth,
  formatLocalDateWithWeekday,
  formatMonth,
  shiftMonth,
  weekdayInitials,
} from '@/dates';

type Props = {
  // YYYY-MM.
  month: string;
  // The month's local dates to mark as trained.
  trainingDays: string[];
  today: string;
  onChangeMonth: (month: string) => void;
  onPressDay: (localDate: string) => void;
};

// A month of days, Sunday first, with the days trained marked, and buttons to
// move a month either way.
export function MonthCalendar({ month, trainingDays, today, onChangeMonth, onPressDay }: Props) {
  const { colors } = useTheme();
  const trained = new Set(trainingDays);

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={12}
          onPress={() => onChangeMonth(shiftMonth(month, -1))}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.monthName, { color: colors.text }]}>
          {formatMonth(month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={12}
          onPress={() => onChangeMonth(shiftMonth(month, 1))}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {weekdayInitials.map((initial, place) => (
          <Text key={place} style={[styles.weekday, { color: colors.text }]}>
            {initial}
          </Text>
        ))}
      </View>
      {calendarWeeks(month).map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((localDate, place) =>
            localDate ? (
              <CalendarDay
                key={localDate}
                localDate={localDate}
                trained={trained.has(localDate)}
                isToday={localDate === today}
                onPress={() => onPressDay(localDate)}
              />
            ) : (
              <View key={place} style={styles.place} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

type CalendarDayProps = {
  localDate: string;
  trained: boolean;
  isToday: boolean;
  onPress: () => void;
};

// A trained day is filled in; today is ringed.
function CalendarDay({ localDate, trained, isToday, onPress }: CalendarDayProps) {
  const { colors } = useTheme();
  const label = [formatLocalDateWithWeekday(localDate), isToday && 'today', trained && 'trained']
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.place}
    >
      <View
        style={[
          styles.mark,
          {
            backgroundColor: trained ? colors.primary : 'transparent',
            borderColor: isToday ? colors.primary : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            { color: trained ? '#ffffff' : colors.text },
            isToday && styles.today,
          ]}
        >
          {dayOfMonth(localDate)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  monthName: {
    fontSize: 18,
    fontWeight: '600',
  },
  week: {
    flexDirection: 'row',
  },
  place: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 16,
  },
  today: {
    fontWeight: '700',
  },
});
