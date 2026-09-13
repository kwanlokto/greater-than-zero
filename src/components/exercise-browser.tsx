import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'expo-router';
import { useState, type ComponentProps, type ReactElement } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { muscleGroups, type Exercise, type MuscleGroup } from '@/core/tracker';
import { tracker } from '@/database';
import { muscleGroupLabels, trackingTypeLabels } from '@/exercise-labels';
import { useTrackerQuery } from '@/use-tracker-query';

type Props = {
  renderExercise: (exercise: Exercise) => ReactElement;
};

// The Exercise library with search by name and a muscle-group filter.
export function ExerciseBrowser({ renderExercise }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>();
  const exercises = useTrackerQuery(
    () => tracker.searchExercises({ query, muscleGroup }),
    [query, muscleGroup],
  );

  return (
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises"
        placeholderTextColor="#8e8e93"
        autoCorrect={false}
        style={[
          styles.search,
          { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
        ]}
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
        data={exercises ?? []}
        keyExtractor={exercise => exercise.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => renderExercise(item)}
        ListEmptyComponent={
          exercises && (
            <Text style={[styles.empty, { color: colors.text }]}>No exercises match.</Text>
          )
        }
      />
    </View>
  );
}

type RowProps = {
  exercise: Exercise;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function ExerciseRow({ exercise, onPress, icon }: RowProps) {
  const { colors } = useTheme();
  const details = [
    muscleGroupLabels[exercise.muscleGroup],
    trackingTypeLabels[exercise.trackingType],
    exercise.isCustom && 'Custom',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]}>{exercise.name}</Text>
        <Text style={[styles.details, { color: colors.text }]}>{details}</Text>
      </View>
      {icon && <Ionicons name={icon} size={20} color={colors.text} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  search: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  filterBar: {
    flexGrow: 0,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  details: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
});
