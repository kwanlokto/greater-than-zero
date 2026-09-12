import { useTheme } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  muscleGroups,
  type Exercise,
  type MuscleGroup,
  type TrackingType,
} from '@/core/tracker';
import { tracker } from '@/database';

const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

const trackingTypeLabels: Record<TrackingType, string> = {
  weighted: 'Weighted',
  bodyweight: 'Bodyweight',
};

export default function ExerciseLibraryScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>();
  const [exercises, setExercises] = useState<Exercise[]>();

  useEffect(() => {
    // Ignore results that arrive after a newer search has started.
    let current = true;
    tracker.searchExercises({ query, muscleGroup }).then(found => {
      if (current) setExercises(found);
    });
    return () => {
      current = false;
    };
  }, [query, muscleGroup]);

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
        <FilterChip
          label="All"
          selected={muscleGroup === undefined}
          onPress={() => setMuscleGroup(undefined)}
        />
        {muscleGroups.map(group => (
          <FilterChip
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
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.details, { color: colors.text }]}>
              {muscleGroupLabels[item.muscleGroup]} · {trackingTypeLabels[item.trackingType]}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          exercises && (
            <Text style={[styles.empty, { color: colors.text }]}>No exercises match.</Text>
          )
        }
      />
    </View>
  );
}

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : 'transparent',
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? '#ffffff' : colors.text }]}>
        {label}
      </Text>
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
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
