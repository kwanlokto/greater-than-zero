import { useTheme } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { formatBodyWeight } from '@/body-weight-labels';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { useTrackerQuery } from '@/use-tracker-query';

// Every Weigh-in, the latest first: the body-weight trend's values as a list.
export default function WeighInsScreen() {
  const { colors } = useTheme();
  const trend = useTrackerQuery(() => tracker.getBodyWeightTrend(), []);

  return (
    <FlatList
      data={trend ? [...trend.points].reverse() : []}
      keyExtractor={point => point.localDate}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.date, { color: colors.text }]}>
            {formatLocalDateWithWeekday(item.localDate)}
          </Text>
          <Text style={[styles.weight, { color: colors.text }]}>
            {trend && formatBodyWeight({ value: item.displayValue, unit: trend.unit })}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        trend && <Text style={[styles.empty, { color: colors.text }]}>No weigh-ins yet.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: {
    fontSize: 16,
  },
  weight: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
