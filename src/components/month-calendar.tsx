import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { IconButton } from '@/components/icon-button';
import { addMonths, calendarWeeks, partsOf, relativeToToday } from '@/core/tracker';
import { formatLocalDateWithWeekday, formatMonth, weekdayInitials } from '@/dates';
import { space, useAppTheme } from '@/theme';

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
  const trained = new Set(trainingDays);
  const count = trainingDays.length;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          label="Previous month"
          onPress={() => onChangeMonth(addMonths(month, -1))}
        />
        <View style={styles.title}>
          <AppText accessibilityRole="header" variant="heading">
            {formatMonth(month)}
          </AppText>
          <AppText variant="caption" tone="muted">
            {count === 1 ? '1 day trained' : `${count} days trained`}
          </AppText>
        </View>
        <IconButton
          icon="chevron-forward"
          label="Next month"
          onPress={() => onChangeMonth(addMonths(month, 1))}
        />
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {weekdayInitials.map((initial, place) => (
          <AppText key={place} variant="label" tone="muted" style={styles.weekday}>
            {initial}
          </AppText>
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
                isToday={relativeToToday(localDate, today) === 'today'}
                isAhead={relativeToToday(localDate, today) === 'ahead'}
                onPress={() => onPressDay(localDate)}
              />
            ) : (
              <View key={place} style={styles.place} />
            ),
          )}
        </View>
      ))}
      <View style={styles.legend}>
        <View style={styles.key}>
          <DayMark trained isToday={false} small />
          <AppText variant="caption" tone="muted">
            Trained
          </AppText>
        </View>
        <View style={styles.key}>
          <DayMark trained={false} isToday small />
          <AppText variant="caption" tone="muted">
            Today
          </AppText>
        </View>
      </View>
    </Card>
  );
}

type CalendarDayProps = {
  localDate: string;
  trained: boolean;
  isToday: boolean;
  isAhead: boolean;
  onPress: () => void;
};

// A trained day is filled in; today is ringed; days still to come are muted.
function CalendarDay({ localDate, trained, isToday, isAhead, onPress }: CalendarDayProps) {
  const { colors } = useAppTheme();
  const label = [formatLocalDateWithWeekday(localDate), isToday && 'today', trained && 'trained']
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.place, pressed && styles.pressed]}
    >
      <DayMark trained={trained} isToday={isToday}>
        <AppText
          variant={isToday || trained ? 'bodyStrong' : 'body'}
          style={{
            color: trained ? colors.onPrimary : isAhead ? colors.textMuted : colors.text,
          }}
        >
          {partsOf(localDate).day}
        </AppText>
      </DayMark>
    </Pressable>
  );
}

type DayMarkProps = {
  trained: boolean;
  isToday: boolean;
  // For the legend.
  small?: boolean;
  children?: React.ReactNode;
};

// The ring around today, and inside it the fill of a trained day, so a day
// that's both shows both.
function DayMark({ trained, isToday, small = false, children }: DayMarkProps) {
  const { colors } = useAppTheme();
  const size = small ? 18 : 42;
  const ring = small ? 2 : 2.5;
  const inner = isToday ? size - ring * 4 : size;

  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: isToday ? colors.primary : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.mark,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: trained ? colors.primary : 'transparent',
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.md,
  },
  title: {
    flex: 1,
    alignItems: 'center',
  },
  week: {
    flexDirection: 'row',
  },
  place: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingBottom: space.xs,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
    paddingTop: space.md,
  },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
