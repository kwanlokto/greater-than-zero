import { FlatList, StyleSheet } from 'react-native';

import { formatBodyWeight } from '@/body-weight-labels';
import { EmptyState } from '@/components/empty-state';
import { Divider, ListRow } from '@/components/list-row';
import { useBottomInset } from '@/components/screen';
import { tracker } from '@/database';
import { formatLocalDateWithWeekday } from '@/dates';
import { space, useAppTheme } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

// Every Weigh-in, the latest first: the body-weight trend's values as a list.
export default function WeighInsScreen() {
  const { colors } = useAppTheme();
  const bottomInset = useBottomInset();
  const trend = useTrackerQuery(() => tracker.getBodyWeightTrend(), []);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.list, { paddingBottom: space.xl + bottomInset }]}
      data={trend ? [...trend.points].reverse() : []}
      keyExtractor={point => point.localDate}
      ItemSeparatorComponent={Divider}
      renderItem={({ item }) => (
        <ListRow
          title={formatLocalDateWithWeekday(item.localDate)}
          value={trend ? formatBodyWeight({ value: item.displayValue, unit: trend.unit }) : ''}
        />
      )}
      ListEmptyComponent={trend && <EmptyState icon="scale-outline" title="No weigh-ins yet." />}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: space.sm,
  },
});
