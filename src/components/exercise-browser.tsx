import { useState, type ReactElement } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/input';
import { Divider, ListRow } from '@/components/list-row';
import { useBottomInset } from '@/components/screen';
import { muscleGroups, type Exercise, type MuscleGroup } from '@/core/tracker';
import { tracker } from '@/database';
import { exerciseDetails, muscleGroupLabels } from '@/exercise-labels';
import { space, useAppTheme } from '@/theme';
import { useTrackerQuery } from '@/use-tracker-query';

type Props = {
  renderExercise: (exercise: Exercise) => ReactElement;
  // Room to leave under the last row, e.g. for a floating button.
  bottomSpace?: number;
};

// The Exercise library with search by name and a muscle-group filter.
export function ExerciseBrowser({ renderExercise, bottomSpace = 0 }: Props) {
  const { colors } = useAppTheme();
  const bottomInset = useBottomInset();
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>();
  const exercises = useTrackerQuery(
    () => tracker.searchExercises({ query, muscleGroup }),
    [query, muscleGroup],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Input
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        icon="search"
        placeholder="Search exercises"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.search}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.filterBar}
        contentContainerStyle={styles.filters}
      >
        <Chip
          label="All"
          selected={muscleGroup === undefined}
          onPress={() => setMuscleGroup(undefined)}
        />
        {muscleGroups.map(group => (
          <Chip
            key={group}
            label={muscleGroupLabels[group]}
            selected={group === muscleGroup}
            onPress={() => setMuscleGroup(group)}
          />
        ))}
      </ScrollView>
      <FlatList
        style={styles.list}
        data={exercises ?? []}
        keyExtractor={exercise => exercise.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => renderExercise(item)}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={{ paddingBottom: bottomInset + bottomSpace }}
        ListEmptyComponent={exercises && <EmptyState icon="search" title="No exercises match." />}
      />
    </View>
  );
}

type RowProps = {
  exercise: Exercise;
  onPress?: () => void;
  icon?: IconName;
};

export function ExerciseRow({ exercise, onPress, icon }: RowProps) {
  const details = exercise.isCustom
    ? `${exerciseDetails(exercise)} · Custom`
    : exerciseDetails(exercise);

  return (
    <ListRow
      title={exercise.name}
      subtitle={details}
      trailingIcon={icon}
      trailingIconTone={icon === 'chevron-forward' ? 'muted' : 'primary'}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  search: {
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  // Keeps its height: a ScrollView would otherwise give it up to the list.
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  list: {
    flex: 1,
  },
  filters: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
